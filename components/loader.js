/**
 * @fileOverview Loader module for restartless addons
 * @author       SHIMODA "Piro" Hiroshi
 * @version      1
 *
 * @license
 *   The MIT License, Copyright (c) 2010-2011 SHIMODA "Piro" Hiroshi.
 *   https://github.com/piroor/restartless/blob/master/license.txt
 * @url http://github.com/piroor/restartless
 */

/** You can customize shared properties for loaded scripts. */
var _namespacePrototype = {
		Cc : Components.classes,
		Ci : Components.interfaces,
		Cu : Components.utils,
		Cr : Components.results,
		Application : Components.classes['@mozilla.org/fuel/application;1']
						.getService(Components.interfaces.fuelIApplication)
	};
var _namespaces;

/**
 * This functiom loads specified script into a unique namespace for the URL.
 * Namespaces for loaded scripts have a wrapped version of this function.
 * Both this and wrapped work like as Components.utils.import().
 * Due to the reserved symbol "import", we have to use another name "load"
 * instead it.
 *
 * @param {String} aScriptURL
 *   URL of a script. Wrapped version of load() can handle related path.
 *   Related path will be resolved based on the location of the caller script.
 * @param {Object=} aExportTarget
 *   EXPORTED_SYMBOLS in the loaded script will be exported to the object.
 *   If no object is specified, symbols will be exported to the global object
 *   of the caller.
 *
 * @returns {Object}
 *   The global object for the loaded script.
 */
function load(aURISpec, aExportTarget, aRoot)
{
	if (!_namespaces)
		_namespaces = {};
	var ns;
	if (aURISpec in _namespaces) {
		ns = _namespaces[aURISpec];
		_exportSymbols(ns, aExportTarget);
		return ns;
	}
	ns = _createNamespace(aURISpec, aRoot || aURISpec);
	Components.classes['@mozilla.org/moz/jssubscript-loader;1']
		.getService(Components.interfaces.mozIJSSubScriptLoader)
		.loadSubScript(aURISpec, ns);
	_exportSymbols(ns, aExportTarget);
	return _namespaces[aURISpec] = ns;
}

function _exportSymbols(aSource, aTarget)
{
	if (!aTarget)
		return;

	// JavaScript code module style
	if (
		('EXPORTED_SYMBOLS' in aSource) &&
		aSource.EXPORTED_SYMBOLS &&
		aSource.EXPORTED_SYMBOLS.map &&
		typeof aSource.EXPORTED_SYMBOLS.map == 'function'
		) {
		aSource.EXPORTED_SYMBOLS.map(function(aSymbol) {
			aTarget[aSymbol] = aSource[aSymbol];
		});
	}

	// CommonJS style
	if (
		('exports' in aSource) &&
		aSource.exports &&
		typeof aSource.exports == 'object'
		) {
		for (let symbol in aSource.exports)
		{
			aTarget[symbol] = aSource[symbol];
		}
	}
}

function _createNamespace(aURISpec, aRoot)
{
	const Cc = Components.classes;
	const Ci = Components.interfaces;
	const IOService = Cc['@mozilla.org/network/io-service;1']
						.getService(Ci.nsIIOService);
	const FileHandler = IOService.getProtocolHandler('file')
						.QueryInterface(Ci.nsIFileProtocolHandler);
	var baseURI = aURISpec.indexOf('file:') == 0 ?
					IOService.newFileURI(FileHandler.getFileFromURLSpec(aURISpec)) :
					IOService.newURI(aURISpec, null, null);
	var rootURI = typeof aRoot == 'string' ?
					(aRoot.indexOf('file:') == 0 ?
						IOService.newFileURI(FileHandler.getFileFromURLSpec(aRoot)) :
						IOService.newURI(aRoot, null, null)
					) :
					aRoot ;
	var exists = aURISpec.indexOf('jar:') == 0 ?
					function(aPath) {
						baseURI = baseURI.QueryInterface(Ci.nsIJARURI);
						var reader = Cc['@mozilla.org/libjar/zip-reader;1']
										.createInstance(Ci.nsIZipReader);
						reader.open(baseURI.JARFile.QueryInterface(Ci.nsIFileURL).file);
					    try {
							let baseEntry = baseURI.JAREntry.replace(/[^\/]+$/, '');
							let entries = reader.findEntries(baseEntry + aPath + '$');
							let found = entries.hasMore();
							return found;
						}
						finally {
							reader.close();
						}
					} :
					function(aPath) {
						return FileHandler.getFileFromURLSpec(baseURI.resolve(aPath)).exists();
					}
	var ns = {
			__proto__ : _namespacePrototype,
			location : _createFakeLocation(baseURI),
			/** JavaScript code module style */
			load : function(aURISpec, aExportTarget) {
				if (!/\.jsm?$/.test(aURISpec)) {
					if (exists(aURISpec+'.js'))
						aURISpec += '.js'
					else if (exists(aURISpec+'.jsm'))
						aURISpec += '.jsm'
				}
				var resolved = baseURI.resolve(aURISpec);
				if (resolved == aURISpec)
					throw new Error('Recursive load!');
				return load(resolved, aExportTarget || ns, rootURI);
			},
			/**
			 * CommonJS style
			 * @url http://www.commonjs.org/specs/
			 */
			require : function(aURISpec) {
				if (!/\.jsm?$/.test(aURISpec)) {
					if (exists(aURISpec+'.js'))
						aURISpec += '.js'
					else if (exists(aURISpec+'.jsm'))
						aURISpec += '.jsm'
				}
				var resolved = (aURISpec.charAt(0) == '.' ? rootURI : baseURI ).resolve(aURISpec);
				if (resolved == aURISpec)
					throw new Error('Recursive load!');
				var exported = {};
				load(resolved, exported, rootURI);
				return exported;
			},
			exports : {}
		};
	return ns;
}

function _createFakeLocation(aURI)
{
	aURI = aURI.QueryInterface(Components.interfaces.nsIURL)
					.QueryInterface(Components.interfaces.nsIURI);
	return {
		href     : aURI.spec,
		search   : aURI.query ? '?'+aURI.query : '' ,
		hash     : aURI.ref ? '#'+aURI.ref : '' ,
		host     : aURI.scheme == 'jar' ? '' : aURI.hostPort,
		hostname : aURI.scheme == 'jar' ? '' : aURI.host,
		port     : aURI.scheme == 'jar' ? -1 : aURI.port,
		pathname : aURI.path,
		protocol : aURI.scheme+':',
		reload   : function() {},
		replace  : function() {},
		toString : function() {
			return this.href;
		}
	};
}

function _callHandler(aHandler, aReason)
{
	for (var i in _namespaces)
	{
		try {
			if (_namespaces[i][aHandler] &&
				typeof _namespaces[i][aHandler] == 'function')
				_namespaces[i][aHandler](aReason);
		}
		catch(e) {
			dump(i+'('+aHandler+', '+aReason+')\n'+e+'\n');
		}
	}
}

function registerResource(aName, aRoot)
{
	Components.classes['@mozilla.org/network/io-service;1']
		.getService(Components.interfaces.nsIIOService)
		.getProtocolHandler('resource')
		.QueryInterface(Components.interfaces.nsIResProtocolHandler)
		.setSubstitution(aName, aRoot);
}

function unregisterResource(aName)
{
	Components.classes['@mozilla.org/network/io-service;1']
		.getService(Components.interfaces.nsIIOService)
		.getProtocolHandler('resource')
		.QueryInterface(Components.interfaces.nsIResProtocolHandler)
		.setSubstitution(aName, null);
}

/** Handler for "install" of the bootstrap.js */
function install(aReason)
{
	_callHandler('iustall', aReason);
}

/** Handler for "uninstall" of the bootstrap.js */
function uninstall(aReason)
{
	_callHandler('uninstall', aReason);
}

/** Handler for "shutdown" of the bootstrap.js */
function shutdown(aReason)
{
	_callHandler('shutdown', aReason);
	_namespaces = void(0);

	load = void(0);
	_exportSymbols = void(0);
	_createNamespace = void(0);
	_callHandler = void(0);
	install = void(0);
	uninstall = void(0);
	shutdown = void(0);
}
