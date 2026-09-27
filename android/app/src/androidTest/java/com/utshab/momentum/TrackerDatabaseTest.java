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
}
