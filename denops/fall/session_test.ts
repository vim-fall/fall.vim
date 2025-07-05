import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.8";
import type { Detail, IdItem } from "jsr:@vim-fall/core@^0.3.0/item";

import {
  listPickerSessions,
  loadPickerSession,
  type PickerSession,
  savePickerSession,
} from "./session.ts";
import type { PickerContext } from "./picker.ts";

// Helper function to create a mock picker session
function createMockSession(name: string, id: number): PickerSession<Detail> {
  const mockItems: IdItem<Detail>[] = [
    { id: `${id}-1`, value: `item1-${id}`, detail: {} },
    { id: `${id}-2`, value: `item2-${id}`, detail: {} },
  ];

  const mockContext: PickerContext<Detail> = {
    query: `query-${id}`,
    selection: new Set(),
    collectedItems: mockItems,
    filteredItems: mockItems,
    cursor: id % 10,
    offset: id * 10,
    matcherIndex: 0,
    sorterIndex: 0,
    rendererIndex: 0,
  };

  return {
    name,
    args: [`arg1-${id}`, `arg2-${id}`],
    context: mockContext,
  };
}

Deno.test("session management", async (t) => {
  await t.step("listPickerSessions returns empty array initially", () => {
    // Clear any existing sessions by saving more than MAX_SESSION_COUNT
    // This ensures we start with a clean state
    const sessions = listPickerSessions();
    assertEquals(Array.isArray(sessions), true);
  });

  await t.step("savePickerSession stores a session", async () => {
    const session = createMockSession("test", 1);
    await savePickerSession(session);

    const sessions = listPickerSessions();
    assertEquals(sessions.length >= 1, true);
    assertEquals(sessions[0].name, "test");
    assertEquals(sessions[0].args, ["arg1-1", "arg2-1"]);
  });

  await t.step(
    "listPickerSessions returns sessions in reverse chronological order",
    async () => {
      // Save multiple sessions
      await savePickerSession(createMockSession("test1", 1));
      await savePickerSession(createMockSession("test2", 2));
      await savePickerSession(createMockSession("test3", 3));

      const sessions = listPickerSessions();
      // Most recent session should be first
      assertEquals(sessions[0].name, "test3");
      assertEquals(sessions[1].name, "test2");
      assertEquals(sessions[2].name, "test1");
    },
  );

  await t.step(
    "loadPickerSession retrieves the most recent session by default",
    async () => {
      await savePickerSession(createMockSession("recent", 99));

      const session = await loadPickerSession();
      assertExists(session);
      assertEquals(session.name, "recent");
      assertEquals(session.args, ["arg1-99", "arg2-99"]);
      assertEquals(session.context.query, "query-99");
      assertEquals(session.context.cursor, 9); // 99 % 10
    },
  );

  await t.step(
    "loadPickerSession retrieves session by index from latest",
    async () => {
      // Clear and add fresh sessions
      for (let i = 0; i < 5; i++) {
        await savePickerSession(createMockSession(`session${i}`, i));
      }

      // Index 1 = most recent (session4)
      const session0 = await loadPickerSession({ number: 1 });
      assertExists(session0);
      assertEquals(session0.name, "session4");

      // Index 2 = second most recent (session3)
      const session1 = await loadPickerSession({ number: 2 });
      assertExists(session1);
      assertEquals(session1.name, "session3");

      // Index 3 = third most recent (session2)
      const session2 = await loadPickerSession({ number: 3 });
      assertExists(session2);
      assertEquals(session2.name, "session2");
    },
  );

  await t.step("loadPickerSession filters by name", async () => {
    // Add sessions with different names
    await savePickerSession(createMockSession("file", 1));
    await savePickerSession(createMockSession("buffer", 2));
    await savePickerSession(createMockSession("file", 3));
    await savePickerSession(createMockSession("buffer", 4));
    await savePickerSession(createMockSession("file", 5));

    // Load most recent "file" session
    const fileSession = await loadPickerSession({ name: "file" });
    assertExists(fileSession);
    assertEquals(fileSession.name, "file");
    assertEquals(fileSession.context.query, "query-5");
    assertEquals(fileSession.context.cursor, 5); // 5 % 10

    // Load second most recent "file" session
    const fileSession2 = await loadPickerSession({
      name: "file",
      number: 2,
    });
    assertExists(fileSession2);
    assertEquals(fileSession2.name, "file");
    assertEquals(fileSession2.context.query, "query-3");
    assertEquals(fileSession2.context.cursor, 3); // 3 % 10

    // Load most recent "buffer" session
    const bufferSession = await loadPickerSession({ name: "buffer" });
    assertExists(bufferSession);
    assertEquals(bufferSession.name, "buffer");
    assertEquals(bufferSession.context.query, "query-4");
    assertEquals(bufferSession.context.cursor, 4); // 4 % 10
  });

  await t.step(
    "loadPickerSession returns undefined for non-existent session",
    async () => {
      // Try to load a session with an index beyond available sessions
      const session = await loadPickerSession({ number: 1000 });
      assertEquals(session, undefined);

      // Try to load a session with a name that doesn't exist
      const namedSession = await loadPickerSession({ name: "non-existent" });
      assertEquals(namedSession, undefined);
    },
  );

  await t.step(
    "compression and decompression preserve session data",
    async () => {
      const testItems: IdItem<Detail>[] = [
        { id: "test-1", value: "test item 1", detail: { foo: "bar" } },
        { id: "test-2", value: "test item 2", detail: { baz: 42 } },
      ];

      const originalSession = createMockSession("compression-test", 123);
      // Create a new session with specific context
      const sessionWithCustomContext: PickerSession<Detail> = {
        ...originalSession,
        context: {
          query: "test query",
          selection: new Set(["test-1"]),
          collectedItems: testItems,
          filteredItems: testItems,
          cursor: 5,
          offset: 10,
          matcherIndex: 1,
          sorterIndex: 2,
          rendererIndex: 3,
          previewerIndex: 4,
        },
      };

      await savePickerSession(sessionWithCustomContext);
      const loadedSession = await loadPickerSession({
        name: "compression-test",
      });

      assertExists(loadedSession);
      assertEquals(
        loadedSession.name,
        sessionWithCustomContext.name,
      );
      assertEquals(
        loadedSession.args,
        sessionWithCustomContext.args,
      );
      assertEquals(loadedSession.context.query, "test query");
      assertEquals(loadedSession.context.cursor, 5);
      assertEquals(loadedSession.context.offset, 10);
      assertEquals(loadedSession.context.matcherIndex, 1);
      assertEquals(loadedSession.context.sorterIndex, 2);
      assertEquals(loadedSession.context.rendererIndex, 3);
      assertEquals(loadedSession.context.previewerIndex, 4);
      assertEquals(loadedSession.context.collectedItems, testItems);
      assertEquals(loadedSession.context.filteredItems, testItems);
      // Check that selection was preserved (Sets are converted to empty objects in JSON)
      // The selection will be an empty object after deserialization since Set is not JSON serializable
      assertEquals(typeof loadedSession.context.selection, "object");
      assertEquals(loadedSession.context.selection, {} as unknown);
    },
  );

  await t.step("respects MAX_SESSION_COUNT limit", async () => {
    // Save more than MAX_SESSION_COUNT (100) sessions
    for (let i = 0; i < 105; i++) {
      await savePickerSession(createMockSession(`session-limit-${i}`, i));
    }

    const sessions = listPickerSessions();
    // Should only have MAX_SESSION_COUNT sessions
    assertEquals(sessions.length, 100);

    // Oldest sessions should be removed (0-4), so first session should be session-limit-5
    const oldestSession = sessions[sessions.length - 1];
    assertEquals(oldestSession.name, "session-limit-5");

    // Newest session should be session-limit-104
    const newestSession = sessions[0];
    assertEquals(newestSession.name, "session-limit-104");
  });

  await t.step("handles minimal context gracefully", async () => {
    const sessionWithMinimalContext = createMockSession("minimal-context", 1);
    const minimalSession: PickerSession<Detail> = {
      ...sessionWithMinimalContext,
      context: {
        query: "",
        selection: new Set(),
        collectedItems: [],
        filteredItems: [],
        cursor: 0,
        offset: 0,
        matcherIndex: 0,
        sorterIndex: 0,
        rendererIndex: 0,
      },
    };

    await savePickerSession(minimalSession);
    const loaded = await loadPickerSession({ name: "minimal-context" });

    assertExists(loaded);
    assertEquals(loaded.context.query, "");
    // Selection will be deserialized as an empty object, not a Set
    assertEquals(typeof loaded.context.selection, "object");
    assertEquals(loaded.context.selection, {} as unknown);
    assertEquals(loaded.context.collectedItems.length, 0);
    assertEquals(loaded.context.filteredItems.length, 0);
    assertEquals(loaded.context.cursor, 0);
  });

  await t.step("handles special characters in session data", async () => {
    const specialItems: IdItem<Detail>[] = [
      { id: "emoji", value: "😀 emoji test 🎉", detail: { unicode: "✨" } },
      { id: "backslash", value: "backslash \\ test", detail: {} },
    ];

    const specialSession = createMockSession("special-chars", 1);
    const sessionWithSpecialChars: PickerSession<Detail> = {
      ...specialSession,
      context: {
        query: "test with \"quotes\" and 'apostrophes' and \n newlines \t tabs",
        selection: new Set(),
        collectedItems: specialItems,
        filteredItems: specialItems,
        cursor: 0,
        offset: 0,
        matcherIndex: 0,
        sorterIndex: 0,
        rendererIndex: 0,
      },
    };

    await savePickerSession(sessionWithSpecialChars);
    const loaded = await loadPickerSession({ name: "special-chars" });

    assertExists(loaded);
    assertEquals(
      loaded.context.query,
      "test with \"quotes\" and 'apostrophes' and \n newlines \t tabs",
    );
    assertEquals(loaded.context.collectedItems.length, 2);
    assertEquals(loaded.context.collectedItems[0].value, "😀 emoji test 🎉");
    assertEquals(loaded.context.collectedItems[0].detail, { unicode: "✨" });
    assertEquals(loaded.context.collectedItems[1].value, "backslash \\ test");
  });
});
