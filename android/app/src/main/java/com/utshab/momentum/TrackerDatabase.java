package com.utshab.momentum;

import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONObject;

/** Durable, transactional local storage. Updates never clear or recreate user data. */
public final class TrackerDatabase extends SQLiteOpenHelper {
    public TrackerDatabase(Context context) { super(context, "momentum.db", null, 1); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE tracker (id INTEGER PRIMARY KEY CHECK(id=1), document TEXT NOT NULL, revision INTEGER NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Future versions must use additive migrations, never DROP this table.
        throw new IllegalStateException("Unsupported database upgrade");
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
}
