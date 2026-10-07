package com.utshab.momentum;

import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONObject;

/** Durable, transactional local storage. Updates never clear or recreate user data. */
public final class TrackerDatabase extends SQLiteOpenHelper {
    public TrackerDatabase(Context context) { super(context, "momentum.db", null, 2); }
    @Override public void onConfigure(SQLiteDatabase db) {
        try (Cursor c = db.rawQuery("PRAGMA secure_delete=ON", null)) {
            if (!c.moveToFirst() || c.getInt(0) != 1) throw new IllegalStateException("Could not enable secure database deletion.");
        }
    }
    private void createVaultTables(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS private_tracker (id INTEGER PRIMARY KEY CHECK(id=1), document TEXT NOT NULL, revision INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS private_attempts (id INTEGER PRIMARY KEY CHECK(id=1), failures INTEGER NOT NULL, next_allowed INTEGER NOT NULL)");
    }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE tracker (id INTEGER PRIMARY KEY CHECK(id=1), document TEXT NOT NULL, revision INTEGER NOT NULL)");
        createVaultTables(db);
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion == 1 && newVersion == 2) createVaultTables(db);
        else throw new IllegalStateException("Unsupported database upgrade");
    }
    public synchronized JSONObject read() throws Exception {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT document, revision FROM tracker WHERE id=1", null)) {
            if (!c.moveToFirst()) return new JSONObject().put("state", JSONObject.NULL).put("revision", 0);
            return new JSONObject().put("state", new JSONObject(c.getString(0))).put("revision", c.getLong(1));
        }
    }
    public synchronized JSONObject write(String document, long revision) throws Exception {
        if (document == null || document.length() > 2000000 || revision < 0) throw new IllegalArgumentException("Invalid tracker size or revision");
        JSONObject value = new JSONObject(document);
        if (value.getInt("version") != 1 || !value.has("habits") || !value.has("entries") || !value.has("reviews") || !value.has("goals")) throw new IllegalArgumentException("Invalid tracker document");
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            long current = 0;
            boolean exists;
            try (Cursor c = db.rawQuery("SELECT revision FROM tracker WHERE id=1", null)) {
                exists = c.moveToFirst();
                if (exists) current = c.getLong(0);
            }
            if (revision != current) throw new IllegalStateException("Your tracker changed. Reopen it before saving again.");
            ContentValues row = new ContentValues();
            row.put("id", 1); row.put("document", document); row.put("revision", current + 1);
            if (exists) db.update("tracker", row, "id=1", null);
            else db.insertOrThrow("tracker", null, row);
            db.setTransactionSuccessful();
            return new JSONObject().put("revision", current + 1);
        } finally { db.endTransaction(); }
    }
    public synchronized JSONObject readVault() throws Exception {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT document, revision FROM private_tracker WHERE id=1", null)) {
            if (!c.moveToFirst()) return new JSONObject().put("document", JSONObject.NULL).put("revision", 0);
            return new JSONObject().put("document", c.getString(0)).put("revision", c.getLong(1));
        }
    }
    public synchronized void reserveVaultAttempt(long now) throws Exception {
        SQLiteDatabase db = getWritableDatabase();
        int failures = 0; long next = 0;
        try (Cursor c = db.rawQuery("SELECT failures, next_allowed FROM private_attempts WHERE id=1", null)) {
            if (c.moveToFirst()) { failures = c.getInt(0); next = c.getLong(1); }
        }
        if (next > now) throw new IllegalStateException("Too many attempts. Try again in " + ((next - now + 999) / 1000) + " seconds.");
        failures = Math.min(failures + 1, 16);
        long delay = failures < 5 ? 0 : Math.min(1800000L, 30000L * (1L << (failures - 5)));
        ContentValues row = new ContentValues(); row.put("id", 1); row.put("failures", failures); row.put("next_allowed", now + delay);
        if (db.insertWithOnConflict("private_attempts", null, row, SQLiteDatabase.CONFLICT_REPLACE) < 0) throw new IllegalStateException("Could not record unlock attempt.");
    }
    public synchronized void resetVaultAttempts() { getWritableDatabase().delete("private_attempts", "id=1", null); }
    public synchronized JSONObject commitVault(String encrypted, long revision, String publicDocument, long publicRevision) throws Exception {
        if (encrypted == null || encrypted.length() > 6000000 || revision < 0) throw new IllegalArgumentException("Invalid private document");
        SQLiteDatabase db = getWritableDatabase(); db.beginTransaction();
        try {
            long current = readVault().getLong("revision");
            if (revision != current) throw new IllegalStateException("Private data changed. Lock and reopen before saving.");
            // Both writes share a transaction, so a failed move never loses or duplicates a habit.
            if (publicDocument != null) write(publicDocument, publicRevision);
            ContentValues row = new ContentValues(); row.put("id", 1); row.put("document", encrypted); row.put("revision", current + 1);
            if (db.insertWithOnConflict("private_tracker", null, row, SQLiteDatabase.CONFLICT_REPLACE) < 0) throw new IllegalStateException("Could not save private habits.");
            db.setTransactionSuccessful(); return new JSONObject().put("revision", current + 1);
        } finally { db.endTransaction(); }
    }
}
