/**
 * Devlog — Firebase Service
 * 
 * Email/password auth + Firestore CRUD.
 * No OAuth, no chrome.identity, no popup auth headaches.
 * 
 * Firestore structure:
 *   users/{uid}/entries/{entryId}
 *     - content: string
 *     - tags: string[]
 *     - pinned: boolean
 *     - createdAt: timestamp
 *     - updatedAt: timestamp
 *     - wordCount: number
 */

const db = {
  app: null,
  auth: null,
  firestore: null,
  user: null,

  init() {
    if (this.app) return;
    this.app = firebase.initializeApp(FIREBASE_CONFIG);
    this.auth = firebase.auth();
    this.firestore = firebase.firestore();
    // Persist auth state across extension reopens
    this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  },

  // ── Auth ──

  async signUp(email, password) {
    this.init();
    const result = await this.auth.createUserWithEmailAndPassword(email, password);
    this.user = result.user;
    return this.user;
  },

  async signIn(email, password) {
    this.init();
    const result = await this.auth.signInWithEmailAndPassword(email, password);
    this.user = result.user;
    return this.user;
  },

  async signOut() {
    await this.auth.signOut();
    this.user = null;
  },

  async resetPassword(email) {
    this.init();
    await this.auth.sendPasswordResetEmail(email);
  },

  onAuthChange(callback) {
    this.init();
    this.auth.onAuthStateChanged((user) => {
      this.user = user;
      callback(user);
    });
  },

  // ── Helpers ──

  _entriesRef() {
    if (!this.user) throw new Error("Not authenticated");
    return this.firestore
      .collection("users")
      .doc(this.user.uid)
      .collection("entries");
  },

  _wordCount(text) {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  },

  // ── Notebooks ──

  _notebooksRef() {
    if (!this.user) throw new Error("Not authenticated");
    return this.firestore.collection("users").doc(this.user.uid).collection("notebooks");
  },

  async createNotebook(name, color) {
    const snap = await this._notebooksRef().get();
    return this._notebooksRef().add({
      name, color, order: snap.size,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async getNotebooks() {
    const snap = await this._notebooksRef().orderBy("order", "asc").get();
    const list = [];
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    return list;
  },

  async updateNotebook(id, name, color) {
    await this._notebooksRef().doc(id).update({ name, color });
  },

  async deleteNotebook(id) {
    const entries = await this._entriesRef().where("notebookId", "==", id).get();
    const batch = this.firestore.batch();
    entries.forEach(doc => batch.update(doc.ref, { notebookId: null }));
    await batch.commit();
    await this._notebooksRef().doc(id).delete();
  },

  async moveEntryToNotebook(entryId, notebookId) {
    await this._entriesRef().doc(entryId).update({ notebookId: notebookId || null });
  },

  // ── CRUD ──

  async createEntry(content, tags = [], pinned = false, notebookId = null) {
    const ref = this._entriesRef();
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const data = {
      content, tags, pinned,
      wordCount: this._wordCount(content),
      createdAt: now, updatedAt: now,
      _searchContent: content.toLowerCase()
    };
    if (notebookId) data.notebookId = notebookId;
    const doc = await ref.add(data);
    return doc.id;
  },

  async updateEntry(entryId, content, tags, pinned) {
    const ref = this._entriesRef().doc(entryId);

    // Save current version before updating
    const current = await ref.get();
    if (current.exists) {
      const d = current.data();
      await ref.collection("versions").add({
        content: d.content, tags: d.tags || [], pinned: d.pinned || false,
        wordCount: d.wordCount || 0, savedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    await ref.update({
      content, tags, pinned,
      wordCount: this._wordCount(content),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      _searchContent: content.toLowerCase()
    });
  },

  async getVersions(entryId) {
    const snap = await this._entriesRef().doc(entryId)
      .collection("versions").orderBy("savedAt", "desc").limit(50).get();
    const versions = [];
    snap.forEach(doc => versions.push({ id: doc.id, ...doc.data() }));
    return versions;
  },

  async restoreVersion(entryId, version) {
    const ref = this._entriesRef().doc(entryId);
    // Save current state as version first
    const current = await ref.get();
    if (current.exists) {
      const d = current.data();
      await ref.collection("versions").add({
        content: d.content, tags: d.tags || [], pinned: d.pinned || false,
        wordCount: d.wordCount || 0, savedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await ref.update({
      content: version.content, tags: version.tags || [],
      pinned: version.pinned || false,
      wordCount: version.wordCount || this._wordCount(version.content),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      _searchContent: version.content.toLowerCase()
    });
  },

  async togglePin(entryId, pinned) {
    const updates = { pinned };
    if (pinned) updates.pinOrder = 0;
    await this._entriesRef().doc(entryId).update(updates);
  },

  async updatePinOrder(updates) {
    const batch = this.firestore.batch();
    updates.forEach(({ entryId, pinOrder }) => {
      batch.update(this._entriesRef().doc(entryId), { pinOrder });
    });
    await batch.commit();
  },

  async deleteEntry(entryId) {
    await this._entriesRef().doc(entryId).delete();
  },

  // ── Read ──

  async getEntries(limit = 30, startAfterDoc = null, tagFilter = null, notebookId = null) {
    let query = this._entriesRef().orderBy("createdAt", "desc").limit(limit);

    if (tagFilter) {
      query = query.where("tags", "array-contains", tagFilter);
    }
    if (notebookId && !tagFilter) {
      query = this._entriesRef().where("notebookId", "==", notebookId).orderBy("createdAt", "desc").limit(limit);
    }
    if (startAfterDoc) {
      query = query.startAfter(startAfterDoc);
    }

    const snapshot = await query.get();
    const entries = [];
    let lastDoc = null;

    snapshot.forEach((doc) => {
      entries.push({ id: doc.id, ...doc.data(), _snap: doc });
      lastDoc = doc;
    });

    return { entries, lastDoc: snapshot.size === limit ? lastDoc : null };
  },

  async getEntriesForFiltering(limit = 500) {
    const query = this._entriesRef().orderBy("createdAt", "desc").limit(limit);
    const snapshot = await query.get();
    const entries = [];
    snapshot.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));
    return entries;
  },

  async getPinnedEntries() {
    const query = this._entriesRef()
      .where("pinned", "==", true)
      .orderBy("createdAt", "desc")
      .limit(50);

    const snapshot = await query.get();
    const entries = [];
    snapshot.forEach((doc) => {
      entries.push({ id: doc.id, ...doc.data() });
    });

    // Sort by pinOrder ascending, preserving createdAt desc as fallback
    entries.sort((a, b) => {
      const ao = typeof a.pinOrder === "number" ? a.pinOrder : Infinity;
      const bo = typeof b.pinOrder === "number" ? b.pinOrder : Infinity;
      return ao - bo;
    });

    return entries;
  },

  async searchEntries(searchTerm, limit = 50) {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return [];

    const query = this._entriesRef()
      .orderBy("createdAt", "desc")
      .limit(300);

    const snapshot = await query.get();
    const results = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data._searchContent && data._searchContent.includes(term)) {
        results.push({ id: doc.id, ...data });
      }
    });

    return results.slice(0, limit);
  },

  async fuzzySearchEntries(searchTerm, limit = 50) {
    const term = searchTerm.trim();
    if (!term) return [];

    const query = this._entriesRef()
      .orderBy("createdAt", "desc")
      .limit(300);

    const snapshot = await query.get();
    const results = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const contentResult = utils.fuzzyScore(term, data.content || "");
      const tagBonus = (data.tags || []).some(t => t.toLowerCase().includes(term.toLowerCase())) ? 20 : 0;
      const totalScore = Math.min(100, contentResult.score + tagBonus);

      if (totalScore > 0) {
        results.push({ id: doc.id, ...data, _relevance: totalScore });
      }
    });

    results.sort((a, b) => b._relevance - a._relevance);
    return results.slice(0, limit);
  },

  async getEntriesGroupedByDay(limit = 200) {
    const query = this._entriesRef()
      .orderBy("createdAt", "desc")
      .limit(limit);

    const snapshot = await query.get();
    const groups = new Map();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const entry = { id: doc.id, ...data };
      if (data.createdAt) {
        const d = data.createdAt.toDate();
        const key = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        if (!groups.has(key)) groups.set(key, { date: key, dateObj: d, entries: [] });
        groups.get(key).entries.push(entry);
      }
    });

    return [...groups.values()];
  },

  async getAllTags() {
    const query = this._entriesRef()
      .orderBy("createdAt", "desc")
      .limit(300);

    const snapshot = await query.get();
    const tagSet = new Set();

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach((t) => tagSet.add(t));
      }
    });

    return [...tagSet].sort();
  },

  // ── Heatmap ──

  async getEntriesByDay() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    cutoff.setHours(0, 0, 0, 0);

    const query = this._entriesRef()
      .where("createdAt", ">=", cutoff)
      .orderBy("createdAt", "asc")
      .limit(2000);

    const snapshot = await query.get();
    const byDay = new Map();

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.createdAt) {
        const d = data.createdAt.toDate();
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        byDay.set(key, (byDay.get(key) || 0) + 1);
      }
    });

    return byDay;
  },

  // ── Stats ──

  async getStats() {
    const query = this._entriesRef().orderBy("createdAt", "desc").limit(500);
    const snapshot = await query.get();

    let totalEntries = 0;
    let totalWords = 0;
    let tagCounts = {};
    let earliest = null;
    let latest = null;

    snapshot.forEach((doc) => {
      const data = doc.data();
      totalEntries++;
      totalWords += data.wordCount || 0;

      const ts = data.createdAt;
      if (ts) {
        if (!earliest || ts < earliest) earliest = ts;
        if (!latest || ts > latest) latest = ts;
      }

      if (data.tags) {
        data.tags.forEach((t) => {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      }
    });

    return {
      totalEntries,
      totalWords,
      avgWordsPerEntry: totalEntries > 0 ? Math.round(totalWords / totalEntries) : 0,
      topTags: Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      earliest,
      latest
    };
  },

  // ── Export ──

  async exportJSON() {
    const query = this._entriesRef().orderBy("createdAt", "desc").limit(1000);
    const snapshot = await query.get();
    const entries = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      entries.push({
        id: doc.id,
        content: data.content,
        tags: data.tags || [],
        pinned: data.pinned || false,
        wordCount: data.wordCount || 0,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null
      });
    });

    return JSON.stringify({ exported: new Date().toISOString(), entries }, null, 2);
  },

  async exportMarkdown() {
    const query = this._entriesRef().orderBy("createdAt", "asc").limit(1000);
    const snapshot = await query.get();
    let md = "# Devlog Export\n\n";

    snapshot.forEach((doc) => {
      const data = doc.data();
      const date = data.createdAt ? data.createdAt.toDate().toLocaleString() : "Unknown date";
      const tags = (data.tags || []).map(t => `#${t}`).join(" ");
      const pin = data.pinned ? " 📌" : "";

      md += `---\n\n`;
      md += `**${date}**${pin}\n\n`;
      md += `${data.content}\n\n`;
      if (tags) md += `${tags}\n\n`;
    });

    return md;
  }
};
