const {execFile} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
// Cache the promise too: concurrent callers share one nonblocking OS query.
let pending;
module.exports = function machineId() {
  if (!pending) pending = (async () => {
    try {
      if (process.platform === 'linux') return (await fs.promises.readFile('/etc/machine-id','utf8')).trim();
      const windows = process.platform === 'win32';
      const output = await new Promise((resolve,reject) => execFile(windows ? 'wmic' : 'ioreg',
        windows ? ['csproduct','get','uuid'] : ['-rd1','-c','IOPlatformExpertDevice'],
        {encoding:'utf8',windowsHide:true,timeout:8000},(error,stdout)=>error?reject(error):resolve(stdout)));
      const value = windows ? output.split(/\r?\n/).map(line=>line.trim()).find(line=>line && line!=='UUID') : output.split('"')[3];
      if (!value) throw new Error('Empty machine identifier');
      return value;
    } catch {
      return crypto.createHash('sha256').update(os.userInfo().username + os.hostname()).digest('hex');
    }
  })();
  return pending;
};
