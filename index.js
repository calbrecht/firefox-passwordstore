const { Cc,Ci,Cu,components } = require("chrome");
var { Class } = require('sdk/core/heritage');
var xpcom = require('sdk/platform/xpcom');
var env = require('sdk/system/environment').env;
var subproc = require("sdk/system/child_process/subprocess");
var prefs = require("sdk/simple-prefs").prefs;

var catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
var loginInfo = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(Ci.nsILoginInfo);

var contractId = '@github.com/calbrecht/firefox-passwordstore;1';

Cu.import("resource://gre/modules/Services.jsm");
var prefBranch = Services.prefs.getBranch("signon.");
prefBranch.setBoolPref("debug", true);

var error = function error(err) {
    console.log(err);
}

var mapSearch = function mapSearch(value) {
    if (undefined === value || null === value || '' === value) {
        return '*';
    }
    return encodeURIComponent(value);
};

var mkSearch = function mkSearch(...args) {
    return args.map(mapSearch).join(':');
};

var mkPath = function mkPath(...args) {
    return 'firefox/' + mkSearch.apply(null, args);
};

var mapInfo = function mapInfo(value) {
    if ('*' === value) {
        return '';
    }
    return decodeURIComponent(value);
};

var mkCloneInfoInit = function mkCloneInfoInit(
    hostname,
    formSubmitURL,
    httpRealm,
    username,
    password,
    usernameField,
    passwordField
) {
    var info = loginInfo.clone();
    info.init(
        hostname || '',
        formSubmitURL || (httpRealm ? null : ''),
        httpRealm || (formSubmitURL ? null : ''),
        username || '',
        '',
        usernameField || '',
        passwordField || ''
    );
    return info;
}

var mkInfo = function mkInfo(treeline) {
    var info = null;
    var matches = treeline.match(/\s*-- (.*):(.*):(.*):(.*):(.*):(.*)/);
    if (null !== matches) {
        matches.shift();
        //insert empty password at index 4
        matches.splice(4, 0, '*');
        info = mkCloneInfoInit.apply(null, matches.map(mapInfo));
    }
    return info;
};

var createOutputMapper = function createOutputMapper(mapInto) {
    return function (data) {
        Array.prototype.push.apply(
            mapInto,
            data.split('\n').map(mkInfo).filter(filterEmpty)
        );
    }
}

var filterEmpty = function (value) {
    return value;
};

var PasswordstoreLoginManagerStorage = Class({
    extends:  xpcom.Unknown,
    interfaces: [ 'nsILoginManagerStorage' ],
    initialized: false,
    uiBusy: false,
    _lastFoundInfos: null,
    
    cmd: function cmd(opt, ...args) {
        if (typeof opt === 'string') {
            args.unshift(opt);
            opt = {};
        }
        return subproc.call({
            command: prefs.passCmdPath,
            arguments: args,
            environment: [
                'PATH=' + env.PATH,
                'HOME=' + env.HOME,
                'USER=' + env.USER,
                'DISPLAY=' + env.DISPLAY,
                'GPG_TTY=' + env.GPG_TTY
            ],
            stdin: opt.stdin,
            stdout: opt.stdout,
            stderr: function (data) {
                error(data);
            }
        });
    },
    initialize: function () {
        if (false === this.initialized) {
            this.init();
            this.initialized = true;
        }
    },
    init: function init() {
        this.cmd('init', '--path=' + mkPath(), prefs.gpgId)
    },
    initWithFile: function initWithFile(aInputFile, aOutputFile) {
        // not implemented
    },
    addLogin: function addLogin(login) {
        var opt = {
            stdin: login.password
        };
        var path = mkPath(
            login.hostname,
            login.formSubmitURL,
            login.httpRealm,
            login.username,
            login.usernameField,
            login.passwordField
        );
        this.cmd(opt, 'insert', '--force', '--echo', path);
    },
    mapPassword: function mapPassword(login) {
        var opt = {
            stdout: function (data) {
                login.password = data;
            }
        };
        var path = mkPath(
            login.hostname,
            login.formSubmitURL,
            login.httpRealm,
            login.username,
            login.usernameField,
            login.passwordField
        );
        var proc = this.cmd(opt, 'show', path);
        proc.wait();
    },
    removeLogin: function removeLogin(login) {
        //@TODO
    },
    modifyLogin: function modifyLogin(oldLogin, newLoginData) {
        console.log('modifyLogin', oldLogin, newLoginData);
    },
    getAllLogins: function getAllLogins(count) {
        //@TODO
    },
    removeAllLogins: function removeAllLogins() {
        //@TODO
    },
    getAllDisabledHosts: function getAllDisabledHosts(count) {
        //@TODO
        count.value = 0;
        return [];
    },
    _isInLastFoundInfos: function _isInLastFoundInfos(info) {
        return this._lastFoundInfos && this._lastFoundInfos.some(
            function(l) info.matches(l, true)
        );
    },
    getLoginSavingEnabled: function getLoginSavingEnabled(hostname) {
        var info = mkCloneInfoInit(hostname, '');
        return !this._isInLastFoundInfos(info);
    },
    setLoginSavingEnabled: function setLoginSavingEnabled(hostname, enabled) {
        //@TODO
    },
    searchLogins: function searchLogins(count, matchData) {
        var found = [];
        var opt = {
            stdout: createOutputMapper(found)
        };
        var search = mkSearch(
            matchData.hostname,
            matchData.formSubmitURL,
            matchData.httpRealm,
            matchData.username,
            matchData.usernameField,
            matchData.passwordField
        );
        var proc = this.cmd(opt, 'find', search);
        proc.wait();
        count.value = found.length;
        return found;
    },
    _rememberLastFoundInfos: function _rememberLastFoundInfos(infos) {
        this._lastFoundInfos = [];
        infos.forEach(function (info) {
            this._lastFoundInfos.push(info.clone());
        }, this);
    },
    findLogins: function findLogins(count, hostname, formSubmitURL, httpRealm) {
        var match = mkCloneInfoInit(hostname, formSubmitURL, httpRealm);
        var found = this.searchLogins(count, match);
        this.uiBusy = true;
        this._rememberLastFoundInfos(found);
        found.map(this.mapPassword, this);
        this.uiBusy = false;
        return found;
    },
    countLogins: function countLogins(hostname, formSubmitURL, httpRealm) {
        var match = mkCloneInfoInit(hostname, formSubmitURL, httpRealm);
        var found = this.searchLogins({}, match);
        return found.length;
    }
});

xpcom.Factory({
  contract: contractId,
  Component: PasswordstoreLoginManagerStorage
});

try {
    var currLMS = catMan.getCategoryEntry(
        'login-manager-storage',
        'nsILoginManagerStorage'
    );
    if (contractId !== currLMS) {
        throw new Error();
    }
} catch (e) {
    catMan.addCategoryEntry(
        'login-manager-storage',
        'nsILoginManagerStorage',
        contractId, false, true
    );
}
