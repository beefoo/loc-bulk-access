import browserAPI from './globals.js';
import BulkAccess from './bulk-access.js';
import LOC from './loc.js';

browserAPI.runtime.onStartup.addListener(() => {
  const app = new BulkAccess({ browser: browserAPI, getAPIURL: LOC.getAPIURL });
  app.onStartup();
});

browserAPI.tabs.onActivated.addListener(() => {
  const app = new BulkAccess({ browser: browserAPI, getAPIURL: LOC.getAPIURL });
  app.onStartup();
});

browserAPI.tabs.onUpdated.addListener(() => {
  const app = new BulkAccess({ browser: browserAPI, getAPIURL: LOC.getAPIURL });
  app.onStartup();
});
