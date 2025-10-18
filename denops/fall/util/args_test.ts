import { assertEquals } from "jsr:@std/assert@^1.0.10";
import { extractOption, parseArgs } from "./args.ts";

Deno.test("parseArgs - simple arguments", () => {
  assertEquals(parseArgs("file /path/to/dir"), ["file", "/path/to/dir"]);
});

Deno.test("parseArgs - with double quotes", () => {
  assertEquals(
    parseArgs('file -input="Hello world"'),
    ["file", "-input=Hello world"],
  );
});

Deno.test("parseArgs - with single quotes", () => {
  assertEquals(
    parseArgs("file -input='Hello world'"),
    ["file", "-input=Hello world"],
  );
});

Deno.test("parseArgs - with escaped quotes", () => {
  assertEquals(
    parseArgs('file -input="Hello \\"world\\""'),
    ["file", '-input=Hello "world"'],
  );
});

Deno.test("parseArgs - multiple arguments with quotes", () => {
  assertEquals(
    parseArgs('grep "search term" /path'),
    ["grep", "search term", "/path"],
  );
});

Deno.test("parseArgs - empty string", () => {
  assertEquals(parseArgs(""), []);
});

Deno.test("parseArgs - only spaces", () => {
  assertEquals(parseArgs("   "), []);
});

Deno.test("parseArgs - mixed quotes", () => {
  assertEquals(
    parseArgs(`file -input="He said 'hello'"`),
    ["file", "-input=He said 'hello'"],
  );
});

Deno.test("parseArgs - nested different quotes", () => {
  assertEquals(
    parseArgs(`file -input='She said "hi"'`),
    ["file", '-input=She said "hi"'],
  );
});

Deno.test("extractOption - extracts single option", () => {
  const [values, remaining] = extractOption(
    ["-input=Hello", "file", "/path"],
    "-input=",
  );
  assertEquals(values, ["Hello"]);
  assertEquals(remaining, ["file", "/path"]);
});

Deno.test("extractOption - handles missing option", () => {
  const [values, remaining] = extractOption(["file", "/path"], "-input=");
  assertEquals(values, []);
  assertEquals(remaining, ["file", "/path"]);
});

Deno.test("extractOption - handles multiple occurrences", () => {
  const [values, remaining] = extractOption(
    ["-input=first", "file", "-input=second"],
    "-input=",
  );
  assertEquals(values, ["first", "second"]);
  assertEquals(remaining, ["file"]);
});

Deno.test("extractOption - handles empty value", () => {
  const [values, remaining] = extractOption(["-input=", "file"], "-input=");
  assertEquals(values, [""]);
  assertEquals(remaining, ["file"]);
});

Deno.test("extractOption - with complex arguments", () => {
  const [values, remaining] = extractOption(
    ["grep", "-input=test", "/path/to/file", "-other=value"],
    "-input=",
  );
  assertEquals(values, ["test"]);
  assertEquals(remaining, ["grep", "/path/to/file", "-other=value"]);
});

Deno.test("extractOption - preserves order of extracted values", () => {
  const [values, remaining] = extractOption(
    ["-input=first", "file", "-input=second", "-input=third", "path"],
    "-input=",
  );
  assertEquals(values, ["first", "second", "third"]);
  assertEquals(remaining, ["file", "path"]);
});

// Integration tests for picker:command specification
Deno.test("Integration - -input= before source name is used", () => {
  const cmdline = '-input="Hello world" file /path';
  const allArgs = parseArgs(cmdline);

  const sourceIndex = allArgs.findIndex((arg) => !arg.startsWith("-"));
  const beforeSourceArgs = allArgs.slice(0, sourceIndex);
  const afterSourceArgs = allArgs.slice(sourceIndex);
  const [inputValues] = extractOption(beforeSourceArgs, "-input=");
  const [name, ...sourceArgs] = afterSourceArgs;

  assertEquals(inputValues, ["Hello world"]);
  assertEquals(inputValues.at(-1), "Hello world");
  assertEquals(name, "file");
  assertEquals(sourceArgs, ["/path"]);
});

Deno.test("Integration - -input= after source name becomes source arg", () => {
  const cmdline = 'file -input="test" /path';
  const allArgs = parseArgs(cmdline);

  const sourceIndex = allArgs.findIndex((arg) => !arg.startsWith("-"));
  const beforeSourceArgs = allArgs.slice(0, sourceIndex);
  const afterSourceArgs = allArgs.slice(sourceIndex);
  const [inputValues] = extractOption(beforeSourceArgs, "-input=");
  const [name, ...sourceArgs] = afterSourceArgs;

  assertEquals(inputValues, []); // Not extracted
  assertEquals(inputValues.at(-1), undefined);
  assertEquals(name, "file");
  assertEquals(sourceArgs, ["-input=test", "/path"]); // Treated as source arg
});

Deno.test("Integration - multiple -input= before source (last wins)", () => {
  const cmdline = '-input="first" -input="second" file';
  const allArgs = parseArgs(cmdline);

  const sourceIndex = allArgs.findIndex((arg) => !arg.startsWith("-"));
  const beforeSourceArgs = allArgs.slice(0, sourceIndex);
  const afterSourceArgs = allArgs.slice(sourceIndex);
  const [inputValues] = extractOption(beforeSourceArgs, "-input=");
  const [name, ...sourceArgs] = afterSourceArgs;

  assertEquals(inputValues, ["first", "second"]);
  assertEquals(inputValues.at(-1), "second"); // Last one wins
  assertEquals(name, "file");
  assertEquals(sourceArgs, []);
});

Deno.test("Integration - no source name throws error", () => {
  const cmdline = '-input="test"';
  const allArgs = parseArgs(cmdline);

  const sourceIndex = allArgs.findIndex((arg) => !arg.startsWith("-"));

  assertEquals(sourceIndex, -1); // Should trigger error
});

Deno.test("Integration - empty -input= value is allowed", () => {
  const cmdline = "-input= file";
  const allArgs = parseArgs(cmdline);

  const sourceIndex = allArgs.findIndex((arg) => !arg.startsWith("-"));
  const beforeSourceArgs = allArgs.slice(0, sourceIndex);
  const afterSourceArgs = allArgs.slice(sourceIndex);
  const [inputValues] = extractOption(beforeSourceArgs, "-input=");
  const [name, ...sourceArgs] = afterSourceArgs;

  assertEquals(inputValues, [""]);
  assertEquals(inputValues.at(-1), "");
  assertEquals(name, "file");
  assertEquals(sourceArgs, []);
});
