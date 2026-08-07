const fs=require('fs');
const path=require('path');
const assert=require('assert');

const root='apple/CPRBOS';
const phoneStore=fs.readFileSync(path.join(root,'CPRBOS/PhoneAppStore.swift'),'utf8');
const bridge=fs.readFileSync(path.join(root,'CPRBOS/PhoneWatchBridge.swift'),'utf8');
const watchStore=fs.readFileSync(path.join(root,'CPRBOS Watch App/WatchWorkoutStore.swift'),'utf8');
const watchView=fs.readFileSync(path.join(root,'CPRBOS Watch App/ContentView.swift'),'utf8');
const project=fs.readFileSync(path.join(root,'CPRBOS.xcodeproj/project.pbxproj'),'utf8');
const webConfig=fs.readFileSync('config.js','utf8');
const phoneModels=fs.readFileSync(path.join(root,'CPRBOS/CPRBModels.swift'),'utf8');
const keychain=fs.readFileSync(path.join(root,'CPRBOS/KeychainCredentialStore.swift'),'utf8');
const watchKeychain=fs.readFileSync(path.join(root,'CPRBOS Watch App/WatchCredentialStore.swift'),'utf8');

assert.match(project,/PRODUCT_BUNDLE_IDENTIFIER = com\.chris070694\.CPRBOS;/);
assert.match(project,/PRODUCT_BUNDLE_IDENTIFIER = com\.chris070694\.CPRBOS\.watchkitapp;/);
assert.match(project,/INFOPLIST_KEY_WKCompanionAppBundleIdentifier = com\.chris070694\.CPRBOS;/);
assert.match(project,/INFOPLIST_KEY_CFBundleDisplayName = "CPRB OS";/);
assert.match(project,/WATCHOS_DEPLOYMENT_TARGET = 10\.0;/);
assert.match(project,/IPHONEOS_DEPLOYMENT_TARGET = 17\.0;/);
assert.match(project,/Embed Watch Content/);

assert.match(phoneStore,/grantType: "password"/);
assert.match(phoneStore,/let watchAuth = try await authenticate/);
assert.match(phoneStore,/provisionWatch/);
assert.match(phoneStore,/password = ""/);
assert.match(phoneStore,/grantType: "refresh_token"/);
assert.match(phoneStore,/restoreSession/);
assert.match(phoneStore,/scheduleAutomaticRefresh/);
assert.match(phoneStore,/sessionRefreshTask/);
assert.match(keychain,/import Security/);
assert.match(keychain,/kSecClassGenericPassword/);
assert.match(keychain,/kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
assert.match(watchKeychain,/import Security/);
assert.match(watchKeychain,/kSecClassGenericPassword/);
assert.match(bridge,/updateApplicationContext/);
assert.match(bridge,/"accessToken": accessToken/);
assert.match(bridge,/"signedOut": true/);
assert.match(bridge,/"refreshToken": refreshToken/);
assert.match(bridge,/sessionWatchStateDidChange/);

assert.match(watchStore,/fitness_sessions\?select=id,plan_name_snapshot&status=eq\.active/);
assert.match(watchStore,/fitness_set_logs\?select=/);
assert.match(watchStore,/func changeWeight/);
assert.match(watchStore,/func changeReps/);
assert.match(watchStore,/func toggleSet/);
assert.match(watchStore,/fitness_session_exercises/);
assert.match(watchStore,/grant_type=refresh_token/);
assert.match(watchStore,/WatchCredentialStore/);
assert.match(watchStore,/contextExpiration > Date/);
assert.match(watchView,/Letztes Mal:/);
assert.match(watchView,/Satz erledigt/);

const webKey=webConfig.match(/SUPABASE_KEY = "([^"]+)"/)?.[1];
const nativeKey=phoneModels.match(/supabasePublishableKey = "([^"]+)"/)?.[1];
assert.ok(webKey&&nativeKey,'publishable keys must exist');
assert.strictEqual(nativeKey,webKey,'native app must use the same publishable key as the web client');
assert.doesNotMatch(phoneModels,/service_role|CRON_SECRET/i);

for(const file of fs.readdirSync(root)){
  assert.notStrictEqual(file,'.git','nested git metadata must not be published');
}

console.log('native iPhone bridge and Apple Watch workout sync structure: OK');
