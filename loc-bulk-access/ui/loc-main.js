// This file should contain all logic specific to Library of Congress JSON API
// The main bulk-access.js should be agnostic to data source and one day could support other APIs
(function initLOC() {
  // function for validating an API response
  const apiResponseValidator = (apiResponse) => {
    const resp = { valid: false, message: 'This is not a valid page. Please search or navigate to a page with at least one collection item.' };
    if ('item' in apiResponse) {
      resp.valid = true;
      resp.message = 'Found one collection on this page.';
    } else if ('pagination' in apiResponse && 'results' in apiResponse) {
      if (apiResponse.results.length > 0 && 'item' in apiResponse.results[0]) {
        const count = apiResponse.pagination.of;
        const countF = count.toLocaleString();
        resp.valid = true;
        resp.message = `Found ${countF} items in this search result.`;
        if ('site_type' in apiResponse && apiResponse.site_type === 'collections') {
          resp.message = `Found ${countF} items in this collection.`;
        }
      }
    }
    return resp;
  };

  // function for creating an API URL based on current URL
  const getAPIURL = (url) => {
    const apiURL = Utilities.appendParamsToURL(url, { fo: 'json', c: 150 });
    return apiURL;
  };

  const config = {
    apiResponseValidator,
    baseURL: 'https://www.loc.gov/',
    getAPIURL,
  };
  return new BulkAccess(config);
}());
