package com.utshab.momentum;

import android.content.Context;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.JSONObject;

/** Runs only in the separate .qa application, never the user's daily tracker. */
public class TrackerDatabaseTest {
    private TrackerDatabase database;
    private Context getContext() { return InstrumentationRegistry.getInstrumentation().getTargetContext(); }
    private String document(String name) throws Exception {
        return new JSONObject().put("version", 1).put("name", name)
            .put("habits", new org.json.JSONArray()).put("goals", new org.json.JSONArray())
            .put("entries", new JSONObject()).put("reviews", new JSONObject()).toString();
    }
    @Before public void setUp() throws Exception {
        assertTrue(getContext().getPackageName().endsWith(".qa"));
        getContext().deleteDatabase("momentum.db");
        database = new TrackerDatabase(getContext());
    }
    @After public void tearDown() throws Exception {
        database.close(); getContext().deleteDatabase("momentum.db");
    }
    @Test public void testFirstLaunchIsEmpty() throws Exception {
        assertTrue(database.read().isNull("state")); assertEquals(0, database.read().getInt("revision"));
    }
    @Test public void testCommittedRecordSurvivesReopen() throws Exception {
        database.write(document("Persistent data"), 0); database.close();
        database = new TrackerDatabase(getContext());
        assertEquals("Persistent data", database.read().getJSONObject("state").getString("name"));
        assertEquals(1, database.read().getInt("revision"));
    }
    @Test public void testStaleUpdateCannotOverwrite() throws Exception {
        database.write(document("Keep this"), 0);
        try { database.write(document("Stale"), 0); fail("Stale revision accepted"); }
        catch (IllegalStateException expected) { }
        assertEquals("Keep this", database.read().getJSONObject("state").getString("name"));
        database.write(document("Next"), 1);
        assertEquals(2, database.read().getInt("revision"));
    }
    @Test public void testInvalidDocumentPreservesData() throws Exception {
        database.write(document("Keep this"), 0);
        try { database.write("{}", 1); fail("Invalid document accepted"); }
        catch (Exception expected) { }
        assertEquals("Keep this", database.read().getJSONObject("state").getString("name"));
    }
    @Test public void testUpgradeOpenPreservesExistingDatabase() throws Exception {
        database.write(document("Upgrade safe"), 0); database.close();
        database = new TrackerDatabase(getContext()); database.getWritableDatabase();
        assertEquals("Upgrade safe", database.read().getJSONObject("state").getString("name"));
    }
    @Test public void testVersionOneMigrationPreservesPublicRecords() throws Exception {
        database.close(); getContext().deleteDatabase("momentum.db");
        android.database.sqlite.SQLiteDatabase old = getContext().openOrCreateDatabase("momentum.db", 0, null);
        old.execSQL("CREATE TABLE tracker (id INTEGER PRIMARY KEY CHECK(id=1), document TEXT NOT NULL, revision INTEGER NOT NULL)");
        old.execSQL("INSERT INTO tracker VALUES (1, ?, 7)", new Object[]{document("Before upgrade")});
        old.setVersion(1); old.close();
        database = new TrackerDatabase(getContext());
        assertEquals("Before upgrade", database.read().getJSONObject("state").getString("name"));
        assertEquals(7, database.read().getInt("revision"));
        assertTrue(database.readVault().isNull("document"));
        database.commitVault("encrypted", 0, null, 0);
        assertEquals(2, database.getReadableDatabase().getVersion());
    }
    @Test public void testPrivateStorageIsSeparateAndPersistent() throws Exception {
        database.write(document("Public"), 0);
        database.commitVault("ciphertext", 0, null, 0); database.close();
        database = new TrackerDatabase(getContext());
        assertEquals("ciphertext", database.readVault().getString("document"));
        assertFalse(database.read().toString().contains("ciphertext"));
        assertEquals(1, database.read().getInt("revision"));
    }
    @Test public void testMoveCommitsBothDocumentsAndRejectsStaleRevisions() throws Exception {
        database.write(document("Before move"), 0);
        database.commitVault("before", 0, null, 0);
        database.commitVault("after", 1, document("After move"), 1);
        assertEquals(2, database.read().getInt("revision"));
        assertEquals(2, database.readVault().getInt("revision"));
        try { database.commitVault("bad", 1, document("Stale private"), 2); fail(); }
        catch (IllegalStateException expected) { }
        try { database.commitVault("bad", 2, document("Stale public"), 1); fail(); }
        catch (IllegalStateException expected) { }
        try { database.commitVault("bad", 2, "{}", 2); fail(); }
        catch (Exception expected) { }
        assertEquals("after", database.readVault().getString("document"));
        assertEquals("After move", database.read().getJSONObject("state").getString("name"));
        assertEquals(2, database.read().getInt("revision"));
    }
    @Test public void testFailedPrivateWriteRollsBackPublicMove() throws Exception {
        database.write(document("Keep public"), 0);
        database.commitVault("keep private", 0, null, 0);
        database.getWritableDatabase().execSQL("CREATE TRIGGER fail_private BEFORE INSERT ON private_tracker BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END");
        try { database.commitVault("bad", 1, document("Lost public"), 1); fail(); }
        catch (Exception expected) { }
        assertEquals("Keep public", database.read().getJSONObject("state").getString("name"));
        assertEquals("keep private", database.readVault().getString("document"));
        assertEquals(1, database.read().getInt("revision"));
    }
    @Test public void testFailedAttemptDelaySurvivesRestartAndResetsOnSuccess() throws Exception {
        for (int i = 0; i < 5; i++) database.reserveVaultAttempt(100000);
        database.close(); database = new TrackerDatabase(getContext());
        try { database.reserveVaultAttempt(129999); fail(); }
        catch (IllegalStateException expected) { assertTrue(expected.getMessage().contains("Too many attempts")); }
        database.reserveVaultAttempt(130000);
        try { database.reserveVaultAttempt(189999); fail(); }
        catch (IllegalStateException expected) { }
        database.resetVaultAttempts(); database.reserveVaultAttempt(130001);
    }
    @Test public void testDeviceEncryptionAuthenticatesAndUsesFreshIv() throws Exception {
        VaultProtection protection = new VaultProtection();
        String first = protection.seal("private envelope"), second = protection.seal("private envelope");
        assertFalse(first.contains("private envelope")); assertNotEquals(first, second);
        assertEquals("private envelope", new VaultProtection().open(first));
        JSONObject corrupt = new JSONObject(first);
        byte[] bytes = android.util.Base64.decode(corrupt.getString("data"), android.util.Base64.NO_WRAP);
        bytes[0] ^= 1;
        corrupt.put("data", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP));
        try { protection.open(corrupt.toString()); fail("Tampered ciphertext accepted"); }
        catch (Exception expected) { }
    }
}
