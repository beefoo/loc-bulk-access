import browserAPI from './globals.js';
import BulkAccess from './bulk-access.js';
import LOC from './loc.js';

const app = new BulkAccess({
  apiResponseValidator: LOC.apiResponseValidator,
  browser: browserAPI,
  getAPIURL: LOC.getAPIURL,
});
app.onPopup();
