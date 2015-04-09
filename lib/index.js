const { Cc,Ci,Cu,components } = require("chrome");
const { contractId } = require("./passwordstore");

var categoryManager = Cc["@mozilla.org/categorymanager;1"]
    .getService(Ci.nsICategoryManager);

Cu.import("resource://gre/modules/Services.jsm");
Services.prefs.getBranch("signon.").setBoolPref("debug", true);

exports.main = function main(options) {
    categoryManager.addCategoryEntry(
        'login-manager-storage',
        'nsILoginManagerStorage',
        contractId, false, true
    );
}

exports.onUnload = function onUnload(reason) {
    categoryManager.deleteCategoryEntry(
        'login-manager-storage',
        'nsILoginManagerStorage',
        false
    );
}
