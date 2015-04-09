var { Class } = require('sdk/core/heritage');
var { mkSearch, mkPath, mkInfo, mkInfosMapperFn, error } = require('./util');
var xpcom = require('sdk/platform/xpcom');
var env = require('sdk/system/environment').env;
var subproc = require("sdk/system/child_process/subprocess");
var prefs = require("sdk/simple-prefs").prefs;

exports.contractId = '@github.com/calbrecht/firefox-passwordstore;1';

var PasswordstoreLoginManagerStorage = Class({
    extends:  xpcom.Unknown,
    interfaces: [ 'nsILoginManagerStorage' ],
    initialized: false,
    uiBusy: false,
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
        var path = mkPath(login);
        this.cmd(opt, 'insert', '--force', '--echo', path);
    },
    mapPassword: function mapPassword(login) {
        var opt = {
            stdout: function (data) {
                login.password = data.replace('\n', '');
            }
        };
        var path = mkPath(login);
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
    getLoginSavingEnabled: function getLoginSavingEnabled(hostname) {
        return true;
    },
    setLoginSavingEnabled: function setLoginSavingEnabled(hostname, enabled) {
        //@TODO
    },
    searchLogins: function searchLogins(count, matchData) {
        var found = [];
        var opt = {
            stdout: mkInfosMapperFn(found)
        };
        var search = mkSearch(matchData);
        var proc = this.cmd(opt, 'find', search);
        proc.wait();
        count.value = found.length;
        return found;
    },
    findLogins: function findLogins(count, hostname, formSubmitURL, httpRealm) {
        var match = mkInfo(hostname, formSubmitURL, httpRealm);
        var found = this.searchLogins(count, match);
        found.map(this.mapPassword, this);
        return found;
    },
    countLogins: function countLogins(hostname, formSubmitURL, httpRealm) {
        var match = mkInfo(hostname, formSubmitURL, httpRealm);
        var found = this.searchLogins({}, match);
        return found.length;
    },
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
    // },
    // _isInLastFoundInfos: function _isInLastFoundInfos(info, ignorePassword=false) {
    //     return this._lastFoundInfos && this._lastFoundInfos.some(
    //         function(l) {
    //             console.log('matches info ', info);
    //             console.log('matches logi ', l);
    //             return l.matches(info, ignorePassword);
    //         }
    //     );
    // },
    // _cloneInfos: function _cloneInfos(infos, into=[]) {
    //     infos.forEach(function (info) {
    //         into.push(info.clone());
    //     });
    //     return into;
    // },
    // _rememberLastFoundInfos: function _rememberLastFoundInfos(infos) {
    //     this._lastFoundInfos = this._cloneInfos(infos);
    }
});

xpcom.Factory({
  contract: exports.contractId,
  Component: PasswordstoreLoginManagerStorage
});
