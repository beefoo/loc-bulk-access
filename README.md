# Library of Congress Bulk Access Browser Extension

A free and open source browser extension for Chrome and Firefox to enable bulk access to Library of Congress digital collections data and assets using the [Library's public JSON API](https://www.loc.gov/apis/json-and-yaml/).

## Beta status

This extension is currently in a **public "beta" release**, meaning it is open to the public to try, test, and send feedback. Until it is in a stable state, it will not be available in the Chrome or Firefox extension stores and must be manually installed using the steps below.

## Installation

### Chrome Installation

1. Download the latest [Chrome extension](https://github.com/LibraryOfCongress/loc-bulk-access/releases/download/v0.0.1/loc-bulk-access-chrome-0.0.1.zip) and unzip it. Note: the latest and past versions of the extensions will be listed in the repository's [releases section](https://github.com/LibraryOfCongress/loc-bulk-access/releases).
2. Go to the Extensions page by entering `chrome://extensions` in a new tab.
3. Enable Developer Mode by clicking the toggle switch next to **Developer mode**.
4. Click the **Load unpacked** button and select the unzipped extension directory.
5. Click **Extensions menu puzzle button** next to your search bar, and you should see the "LC Bulk Access" extension listed there, which you can pin to your toolbar.

You can also find these instructions on the [Chrome Extension Developer website](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked).

### Firefox Installation

1. Download the latest [Firefox extension](https://github.com/LibraryOfCongress/loc-bulk-access/releases/download/v0.0.1/loc-bulk-access-firefox-0.0.1.zip). Note: the latest and past versions of the extensions will be listed in the repository's [releases section](https://github.com/LibraryOfCongress/loc-bulk-access/releases).
2. Type `about:addons` in the Firefox URL bar.
3. Next to "Manage Your Extensions", click the gear icon, select **Install Add-on From File**, and select the zipped file that you downloaded from step 1.
4. Once installed, click **Extensions menu puzzle button** next to your search bar, and you should see the "LC Bulk Access" extension listed there, which you can pin to your toolbar.

## Using the extension

Once you install the extension using the instructions in the previous section, you can follow the following instructions:

1. Perform any search or facet on loc.gov using the search bar or browsing to a specific collection.

## For Developers

The latest versions of Chrome and Firefox extension APIs are nearly the same, so we recommend developing using Firefox and the [web-ext](https://github.com/mozilla/web-ext) command line tool that will listen for changes to the code and refresh the extension automatically. To run and edit the extension locally, you can do so with the following steps.

1. Make sure you have [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git), [Node.js](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs), and [Firefox](https://www.mozilla.org/en-US/firefox/new/) installed on your computer.

2. Clone this repository:

    ```
    git clone https://github.com/LibraryOfCongress/loc-bulk-access.git
    cd loc-bulk-access
    ```

3. Install Node.js dependencies, including the [web-ext](https://github.com/mozilla/web-ext) command line tool

    ```
    npm install --global web-ext
    npm install
    ```

4. Now you can launch this extension using Firefox and web-ext using the following command:

    ```
    npm run listen
    ```

    Any changes you make in the code will automatically refresh the extension in the Firefox browser

5. Once you test your changes, you should also test your changes in Chrome. You can do this by running:

    ```
    npm run use-chrome
    ```

    Then [follow these instructions](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked) for loading an unpacked extension, selecting the `.loc-bulk-access/` folder as the unpacked extension.  If you need to switch back to developing on Firefox, run:

    ```
    npm run use-firefox
    ```

6. If you commit your changes and are ready to make a new release, update both `manifest-chrome.json` and `manifest-firefox.json` with an updated "version" key. Then run:

    ```
    npm run build-chrome
    npm run build-firefox
    ```

    This will generate zipped extensions in the `./builds/` directory with the appropriate browser names and versions, which can be uploaded as a release on Github or submitted to the Chrome/Firefox extension stores.
