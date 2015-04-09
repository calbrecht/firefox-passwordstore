const { Cc,Ci,Cu,components } = require("chrome");

var loginInfo = Cc["@mozilla.org/login-manager/loginInfo;1"]
    .createInstance(Ci.nsILoginInfo);

exports.error = function error(err) {
    console.log(err);
};

function encodePath(value) {
    if (undefined === value || null === value || '' === value) {
        return '*';
    }
    return encodeURIComponent(value);
};

function decodePath(value) {
    if ('*' === value) {
        return '';
    }
    return decodeURIComponent(value);
};

function mkArgsFromInfo(info) {
    return [
        info.hostname,
        info.formSubmitURL,
        info.httpRealm,
        info.username,
        info.usernameField,
        info.passwordField
    ];
};

function isInfo(args) {
    return args.length == 1
        && args[0].hasOwnProperty('hostname')
        && args[0].hasOwnProperty('formSubmitURL')
        && args[0].hasOwnProperty('httpRealm')
        && args[0].hasOwnProperty('username')
        && args[0].hasOwnProperty('usernameField')
        && args[0].hasOwnProperty('passwordField');
};

function mkSearchFromArgs(...args) {
    return args.map(encodePath).join(':');
};

function mkSearchFromInfo(info) {
    return mkSearchFromArgs.apply(null, mkArgsFromInfo(info)); 
};

exports.mkSearch = function mkSearch(...args) {
    if (isInfo(args)) {
        return mkSearchFromInfo(args[0]);
    }
    return mkSearchFromArgs.apply(null, args);
};

function mkPathFromArgs(...args) {
    return 'firefox/' + mkSearchFromArgs.apply(null, args);
};

function mkPathFromInfo(info) {
    return mkPathFromArgs.apply(null, mkArgsFromInfo(info)); 
};

exports.mkPath = function mkPath(...args) {
    if (isInfo(args)) {
        return mkPathFromInfo(args[0]);
    }
    return mkPathFromArgs.apply(null, args);
};

function mkInfoClone(
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

exports.mkInfo = function mkInfo(...args) {
    return mkInfoClone.apply(null, args);
};

function filterEmpty(value) {
    return value;
};

function mkInfoFromTreeOutput(line) {
    var info = null;
    var matches = line.match(/\s*-- (.*):(.*):(.*):(.*):(.*):(.*)/);
    if (null !== matches) {
        matches.shift();
        //insert empty password at index 4
        matches.splice(4, 0, '*');
        info = mkInfoClone.apply(null, matches.map(decodePath));
    }
    return info;
}

exports.mkInfosMapperFn = function mkInfosMapperFn(into) {
    return function (data) {
        Array.prototype.push.apply(
            into,
            data.split('\n').map(mkInfoFromTreeOutput).filter(filterEmpty)
        );
    }
}
