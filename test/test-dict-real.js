const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('../background.js', 'utf8');
const fixture = JSON.parse(fs.readFileSync('fixture-hello.json', 'utf8'));

const sandbox = {
  console, setTimeout, clearTimeout, AbortController, URL,
  fetch: async () => ({ ok: true, status: 200, json: async () => fixture }),
  chrome: {
    storage: { sync: { get: (d, cb) => cb({...d}) } },
    runtime: { onInstalled:{addListener(){}}, onMessage:{addListener(){}} },
    contextMenus: { removeAll(cb){cb&&cb()}, create(){}, onClicked:{addListener(){}} },
    commands: { onCommand:{addListener(){}} },
    tabs: { query: async()=>[], sendMessage: async()=>{} }
  }
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'background.js' });

(async () => {
  const d = await sandbox.youdaoDictionary('hello');
  console.log('--- youdaoDictionary ---');
  console.log('translations:', JSON.stringify(d.translations));
  console.log('usphone:', d.usphone, 'ukphone:', d.ukphone);
  console.log('forms:', JSON.stringify(d.forms));
  console.log('examples:', JSON.stringify(d.examples));
  console.log('meanings (longman):', JSON.stringify(d.meanings));
  const full = await sandbox.fetchWordDetail('hello');
  console.log('--- fetchWordDetail ---');
  console.log(JSON.stringify(full, null, 2));
})();
