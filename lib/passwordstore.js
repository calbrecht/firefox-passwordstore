var { Class } = require('sdk/core/heritage');
var { mkSearch, mkPath, mkInfo, mkInfosMapperFn, error, buildModifiedLogin } = require('./util');
var { setTimeout } = require("sdk/timers");
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
        var newLogin = buildModifiedLogin(oldLogin, newLoginData);
        if (!oldLogin.equals(newLogin)) {
            this.addLogin(newLogin);
        }
        this.clearLastFoundInfos();
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
    lastFindInfo: null,
    lastFoundInfos: [],
    clearLastFoundInfos: function clearLastFoundInfos() {
        this.lastFindInfo = null;
        this.lastFoundInfos.forEach(function (info) {
            info.init(
                '',//info.hostname,
                info.formSubmitURL,
                info.httpRealm,
                '',
                '',
                '',//info.usernameField,
                ''//info.passwordField
            );
        })
        this.lastFoundInfos = [];
    },
    rememberLastFound: function rememberLastFound(match, found) {
        this.lastFindInfo = match;
        this.lastFoundInfos = found;
        setTimeout(this.clearLastFoundInfos.bind(this), 45000)
    },
    hasMatchLastFoundInfos: function hasMatchLastFoundInfos(match) {
        if (this.lastFindInfo &&
            this.lastFoundInfos.length &&
            match.matches(this.lastFindInfo, true)) {
            return true;
        }
        return false;
    },
    findLogins: function findLogins(count, hostname, formSubmitURL, httpRealm) {
        var match, found;
        match = mkInfo(hostname, formSubmitURL, httpRealm);
        if (this.hasMatchLastFoundInfos(match)) {
            found = this.lastFoundInfos;
            setTimeout(this.clearLastFoundInfos.bind(this), 45000)
        } else {
            found = this.searchLogins(count, match);
            found.map(this.mapPassword, this);
            this.rememberLastFound(match, found);
        }
        count.value = found.length;
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
    }
});

xpcom.Factory({
  contract: exports.contractId,
  Component: PasswordstoreLoginManagerStorage
});
