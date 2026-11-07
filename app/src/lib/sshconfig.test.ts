import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPort, configEntry, gitAddress, serverEntry, sshPath } from "./sshconfig.ts";

const repo = { host: "github-kona", real_host: "ssh.github.com", user: "git", port: 443, key_path: "C:\\Users\\someone\\.ssh\\kona_rw", repo: "Owner/kona" };

test("a key in the user's own .ssh folder reads as ~/.ssh, any other path keeps its place with forward slashes", () => {
  assert.equal(sshPath("C:\\Users\\someone\\.ssh\\id_ed25519"), "~/.ssh/id_ed25519");
  assert.equal(sshPath("c:/Users/Someone Else/.ssh/key"), "~/.ssh/key");
  assert.equal(sshPath("D:\\keys\\kona"), "D:/keys/kona");
  assert.equal(sshPath("~/.ssh/already"), "~/.ssh/already");
  assert.equal(sshPath("D:\\my keys\\kona"), "\"D:/my keys/kona\"");
});

test("the copied entry holds the port, the real address and the key", () => {
  assert.equal(configEntry(repo), "Host github-kona\n  HostName ssh.github.com\n  User git\n  Port 443\n  IdentityFile ~/.ssh/kona_rw\n  IdentitiesOnly yes");
  assert.match(configEntry({ ...repo, port: 22 }), /\n  Port 22\n/);
  assert.match(configEntry({ ...repo, port: 0 }), /\n  Port 22\n/, "an unset port is the usual 22");
});

test("no key file named means no IdentityFile line, and no empty HostName", () => {
  const e = configEntry({ ...repo, key_path: "", real_host: "" });
  assert.ok(!e.includes("IdentityFile") && !e.includes("IdentitiesOnly") && !e.includes("HostName"), e);
});

test("the entry for a server that pulls the repo names the key on that server", () => {
  const e = serverEntry(repo, "~/.ssh/kona_ro");
  assert.ok(e.includes("Port 443") && e.includes("HostName ssh.github.com") && e.endsWith("IdentityFile ~/.ssh/kona_ro\n  IdentitiesOnly yes"), e);
});

test("the git address uses the nickname, and a port box takes only digits up to 65535", () => {
  assert.equal(gitAddress(repo), "git@github-kona:Owner/kona.git");
  assert.equal(cleanPort("443"), 443);
  assert.equal(cleanPort("4a4b3"), 443);
  assert.equal(cleanPort(""), 0);
  assert.equal(cleanPort("99999999"), 65535);
});
