(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (process){(function (){
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./svg-injector.cjs.production.js')
} else {
  module.exports = require('./svg-injector.cjs.development.js')
}

}).call(this)}).call(this,require('_process'))
},{"./svg-injector.cjs.development.js":2,"./svg-injector.cjs.production.js":3,"_process":5}],2:[function(require,module,exports){
'use strict';

var tslib = require('tslib');
var contentType = require('content-type');

var cache = new Map();

var cloneSvg = function cloneSvg(sourceSvg) {
  return sourceSvg.cloneNode(true);
};

var isLocal = function isLocal() {
  return window.location.protocol === 'file:';
};

var makeAjaxRequest = function makeAjaxRequest(url, httpRequestWithCredentials, callback) {
  var httpRequest = new XMLHttpRequest();
  httpRequest.onreadystatechange = function () {
    try {
      if (!/\.svg/i.test(url) && httpRequest.readyState === 2) {
        var contentType$1 = httpRequest.getResponseHeader('Content-Type');
        if (!contentType$1) {
          throw new Error('Content type not found');
        }
        var type = contentType.parse(contentType$1).type;
        if (!(type === 'image/svg+xml' || type === 'text/plain')) {
          throw new Error("Invalid content type: ".concat(type));
        }
      }
      if (httpRequest.readyState === 4) {
        if (httpRequest.status === 404 || httpRequest.responseXML === null) {
          throw new Error(isLocal() ? 'Note: SVG injection ajax calls do not work locally without ' + 'adjusting security settings in your browser. Or consider ' + 'using a local webserver.' : 'Unable to load SVG file: ' + url);
        }
        if (httpRequest.status === 200 || isLocal() && httpRequest.status === 0) {
          callback(null, httpRequest);
        } else {
          throw new Error('There was a problem injecting the SVG: ' + httpRequest.status + ' ' + httpRequest.statusText);
        }
      }
    } catch (error) {
      httpRequest.abort();
      if (error instanceof Error) {
        callback(error, httpRequest);
      } else {
        throw error;
      }
    }
  };
  httpRequest.open('GET', url);
  httpRequest.withCredentials = httpRequestWithCredentials;
  if (httpRequest.overrideMimeType) {
    httpRequest.overrideMimeType('text/xml');
  }
  httpRequest.send();
};

var requestQueue = {};
var queueRequest = function queueRequest(url, callback) {
  requestQueue[url] = requestQueue[url] || [];
  requestQueue[url].push(callback);
};
var processRequestQueue = function processRequestQueue(url) {
  var _loop_1 = function _loop_1(i, len) {
    setTimeout(function () {
      if (Array.isArray(requestQueue[url])) {
        var cacheValue = cache.get(url);
        var callback = requestQueue[url][i];
        if (cacheValue instanceof SVGSVGElement) {
          callback(null, cloneSvg(cacheValue));
        }
        if (cacheValue instanceof Error) {
          callback(cacheValue);
        }
        if (i === requestQueue[url].length - 1) {
          delete requestQueue[url];
        }
      }
    }, 0);
  };
  for (var i = 0, len = requestQueue[url].length; i < len; i++) {
    _loop_1(i);
  }
};

var loadSvgCached = function loadSvgCached(url, httpRequestWithCredentials, callback) {
  if (cache.has(url)) {
    var cacheValue = cache.get(url);
    if (cacheValue === undefined) {
      queueRequest(url, callback);
      return;
    }
    if (cacheValue instanceof SVGSVGElement) {
      callback(null, cloneSvg(cacheValue));
      return;
    }
  }
  cache.set(url, undefined);
  queueRequest(url, callback);
  makeAjaxRequest(url, httpRequestWithCredentials, function (error, httpRequest) {
    var _a;
    if (error) {
      cache.set(url, error);
    } else if (((_a = httpRequest.responseXML) === null || _a === void 0 ? void 0 : _a.documentElement) instanceof SVGSVGElement) {
      cache.set(url, httpRequest.responseXML.documentElement);
    }
    processRequestQueue(url);
  });
};

var loadSvgUncached = function loadSvgUncached(url, httpRequestWithCredentials, callback) {
  makeAjaxRequest(url, httpRequestWithCredentials, function (error, httpRequest) {
    var _a;
    if (error) {
      callback(error);
    } else if (((_a = httpRequest.responseXML) === null || _a === void 0 ? void 0 : _a.documentElement) instanceof SVGSVGElement) {
      callback(null, httpRequest.responseXML.documentElement);
    }
  });
};

var idCounter = 0;
var uniqueId = function uniqueId() {
  return ++idCounter;
};

var injectedElements = [];
var ranScripts = {};
var svgNamespace = 'http://www.w3.org/2000/svg';
var xlinkNamespace = 'http://www.w3.org/1999/xlink';
var injectElement = function injectElement(el, evalScripts, renumerateIRIElements, cacheRequests, httpRequestWithCredentials, beforeEach, callback) {
  var elUrl = el.getAttribute('data-src') || el.getAttribute('src');
  if (!elUrl) {
    callback(new Error('Invalid data-src or src attribute'));
    return;
  }
  if (injectedElements.indexOf(el) !== -1) {
    injectedElements.splice(injectedElements.indexOf(el), 1);
    el = null;
    return;
  }
  injectedElements.push(el);
  el.setAttribute('src', '');
  var loadSvg = cacheRequests ? loadSvgCached : loadSvgUncached;
  loadSvg(elUrl, httpRequestWithCredentials, function (error, svg) {
    if (!svg) {
      injectedElements.splice(injectedElements.indexOf(el), 1);
      el = null;
      callback(error);
      return;
    }
    var elId = el.getAttribute('id');
    if (elId) {
      svg.setAttribute('id', elId);
    }
    var elTitle = el.getAttribute('title');
    if (elTitle) {
      svg.setAttribute('title', elTitle);
    }
    var elWidth = el.getAttribute('width');
    if (elWidth) {
      svg.setAttribute('width', elWidth);
    }
    var elHeight = el.getAttribute('height');
    if (elHeight) {
      svg.setAttribute('height', elHeight);
    }
    var mergedClasses = Array.from(new Set(tslib.__spreadArray(tslib.__spreadArray(tslib.__spreadArray([], (svg.getAttribute('class') || '').split(' '), true), ['injected-svg'], false), (el.getAttribute('class') || '').split(' '), true))).join(' ').trim();
    svg.setAttribute('class', mergedClasses);
    var elStyle = el.getAttribute('style');
    if (elStyle) {
      svg.setAttribute('style', elStyle);
    }
    svg.setAttribute('data-src', elUrl);
    var elData = [].filter.call(el.attributes, function (at) {
      return /^data-\w[\w-]*$/.test(at.name);
    });
    Array.prototype.forEach.call(elData, function (dataAttr) {
      if (dataAttr.name && dataAttr.value) {
        svg.setAttribute(dataAttr.name, dataAttr.value);
      }
    });
    if (renumerateIRIElements) {
      var iriElementsAndProperties_1 = {
        clipPath: ['clip-path'],
        'color-profile': ['color-profile'],
        cursor: ['cursor'],
        filter: ['filter'],
        linearGradient: ['fill', 'stroke'],
        marker: ['marker', 'marker-start', 'marker-mid', 'marker-end'],
        mask: ['mask'],
        path: [],
        pattern: ['fill', 'stroke'],
        radialGradient: ['fill', 'stroke']
      };
      var element_1;
      var elements_1;
      var properties_1;
      var currentId_1;
      var newId_1;
      Object.keys(iriElementsAndProperties_1).forEach(function (key) {
        element_1 = key;
        properties_1 = iriElementsAndProperties_1[key];
        elements_1 = svg.querySelectorAll(element_1 + '[id]');
        var _loop_1 = function _loop_1(a, elementsLen) {
          currentId_1 = elements_1[a].id;
          newId_1 = currentId_1 + '-' + uniqueId();
          var referencingElements;
          Array.prototype.forEach.call(properties_1, function (property) {
            referencingElements = svg.querySelectorAll('[' + property + '*="' + currentId_1 + '"]');
            for (var b = 0, referencingElementLen = referencingElements.length; b < referencingElementLen; b++) {
              var attrValue = referencingElements[b].getAttribute(property);
              if (attrValue && !attrValue.match(new RegExp('url\\("?#' + currentId_1 + '"?\\)'))) {
                continue;
              }
              referencingElements[b].setAttribute(property, 'url(#' + newId_1 + ')');
            }
          });
          var allLinks = svg.querySelectorAll('[*|href]');
          var links = [];
          for (var c = 0, allLinksLen = allLinks.length; c < allLinksLen; c++) {
            var href = allLinks[c].getAttributeNS(xlinkNamespace, 'href');
            if (href && href.toString() === '#' + elements_1[a].id) {
              links.push(allLinks[c]);
            }
          }
          for (var d = 0, linksLen = links.length; d < linksLen; d++) {
            links[d].setAttributeNS(xlinkNamespace, 'href', '#' + newId_1);
          }
          elements_1[a].id = newId_1;
        };
        for (var a = 0, elementsLen = elements_1.length; a < elementsLen; a++) {
          _loop_1(a);
        }
      });
    }
    svg.removeAttribute('xmlns:a');
    var scripts = svg.querySelectorAll('script');
    var scriptsToEval = [];
    var script;
    var scriptType;
    for (var i = 0, scriptsLen = scripts.length; i < scriptsLen; i++) {
      scriptType = scripts[i].getAttribute('type');
      if (!scriptType || scriptType === 'application/ecmascript' || scriptType === 'application/javascript' || scriptType === 'text/javascript') {
        script = scripts[i].innerText || scripts[i].textContent;
        if (script) {
          scriptsToEval.push(script);
        }
        svg.removeChild(scripts[i]);
      }
    }
    if (scriptsToEval.length > 0 && (evalScripts === 'always' || evalScripts === 'once' && !ranScripts[elUrl])) {
      for (var l = 0, scriptsToEvalLen = scriptsToEval.length; l < scriptsToEvalLen; l++) {
        new Function(scriptsToEval[l])(window);
      }
      ranScripts[elUrl] = true;
    }
    var styleTags = svg.querySelectorAll('style');
    Array.prototype.forEach.call(styleTags, function (styleTag) {
      styleTag.textContent += '';
    });
    svg.setAttribute('xmlns', svgNamespace);
    svg.setAttribute('xmlns:xlink', xlinkNamespace);
    beforeEach(svg);
    if (!el.parentNode) {
      injectedElements.splice(injectedElements.indexOf(el), 1);
      el = null;
      callback(new Error('Parent node is null'));
      return;
    }
    el.parentNode.replaceChild(svg, el);
    injectedElements.splice(injectedElements.indexOf(el), 1);
    el = null;
    callback(null, svg);
  });
};

var SVGInjector = function SVGInjector(elements, _a) {
  var _b = _a === void 0 ? {} : _a,
    _c = _b.afterAll,
    afterAll = _c === void 0 ? function () {
      return undefined;
    } : _c,
    _d = _b.afterEach,
    afterEach = _d === void 0 ? function () {
      return undefined;
    } : _d,
    _e = _b.beforeEach,
    beforeEach = _e === void 0 ? function () {
      return undefined;
    } : _e,
    _f = _b.cacheRequests,
    cacheRequests = _f === void 0 ? true : _f,
    _g = _b.evalScripts,
    evalScripts = _g === void 0 ? 'never' : _g,
    _h = _b.httpRequestWithCredentials,
    httpRequestWithCredentials = _h === void 0 ? false : _h,
    _j = _b.renumerateIRIElements,
    renumerateIRIElements = _j === void 0 ? true : _j;
  if (elements && 'length' in elements) {
    var elementsLoaded_1 = 0;
    for (var i = 0, j = elements.length; i < j; i++) {
      injectElement(elements[i], evalScripts, renumerateIRIElements, cacheRequests, httpRequestWithCredentials, beforeEach, function (error, svg) {
        afterEach(error, svg);
        if (elements && 'length' in elements && elements.length === ++elementsLoaded_1) {
          afterAll(elementsLoaded_1);
        }
      });
    }
  } else if (elements) {
    injectElement(elements, evalScripts, renumerateIRIElements, cacheRequests, httpRequestWithCredentials, beforeEach, function (error, svg) {
      afterEach(error, svg);
      afterAll(1);
      elements = null;
    });
  } else {
    afterAll(0);
  }
};

exports.SVGInjector = SVGInjector;


},{"content-type":4,"tslib":7}],3:[function(require,module,exports){
"use strict";var tslib=require("tslib"),contentType=require("content-type"),cache=new Map,cloneSvg=function(e){return e.cloneNode(!0)},isLocal=function(){return"file:"===window.location.protocol},makeAjaxRequest=function(e,t,r){var n=new XMLHttpRequest;n.onreadystatechange=function(){try{if(!/\.svg/i.test(e)&&2===n.readyState){var t=n.getResponseHeader("Content-Type");if(!t)throw new Error("Content type not found");var i=contentType.parse(t).type;if("image/svg+xml"!==i&&"text/plain"!==i)throw new Error("Invalid content type: ".concat(i))}if(4===n.readyState){if(404===n.status||null===n.responseXML)throw new Error(isLocal()?"Note: SVG injection ajax calls do not work locally without adjusting security settings in your browser. Or consider using a local webserver.":"Unable to load SVG file: "+e);if(!(200===n.status||isLocal()&&0===n.status))throw new Error("There was a problem injecting the SVG: "+n.status+" "+n.statusText);r(null,n)}}catch(e){if(n.abort(),!(e instanceof Error))throw e;r(e,n)}},n.open("GET",e),n.withCredentials=t,n.overrideMimeType&&n.overrideMimeType("text/xml"),n.send()},requestQueue={},queueRequest=function(e,t){requestQueue[e]=requestQueue[e]||[],requestQueue[e].push(t)},processRequestQueue=function(e){for(var t=function(t,r){setTimeout((function(){if(Array.isArray(requestQueue[e])){var r=cache.get(e),n=requestQueue[e][t];r instanceof SVGSVGElement&&n(null,cloneSvg(r)),r instanceof Error&&n(r),t===requestQueue[e].length-1&&delete requestQueue[e]}}),0)},r=0,n=requestQueue[e].length;r<n;r++)t(r)},loadSvgCached=function(e,t,r){if(cache.has(e)){var n=cache.get(e);if(void 0===n)return void queueRequest(e,r);if(n instanceof SVGSVGElement)return void r(null,cloneSvg(n))}cache.set(e,void 0),queueRequest(e,r),makeAjaxRequest(e,t,(function(t,r){var n;t?cache.set(e,t):(null===(n=r.responseXML)||void 0===n?void 0:n.documentElement)instanceof SVGSVGElement&&cache.set(e,r.responseXML.documentElement),processRequestQueue(e)}))},loadSvgUncached=function(e,t,r){makeAjaxRequest(e,t,(function(e,t){var n;e?r(e):(null===(n=t.responseXML)||void 0===n?void 0:n.documentElement)instanceof SVGSVGElement&&r(null,t.responseXML.documentElement)}))},idCounter=0,uniqueId=function(){return++idCounter},injectedElements=[],ranScripts={},svgNamespace="http://www.w3.org/2000/svg",xlinkNamespace="http://www.w3.org/1999/xlink",injectElement=function(e,t,r,n,i,a,o){var l=e.getAttribute("data-src")||e.getAttribute("src");if(l){if(-1!==injectedElements.indexOf(e))return injectedElements.splice(injectedElements.indexOf(e),1),void(e=null);injectedElements.push(e),e.setAttribute("src",""),(n?loadSvgCached:loadSvgUncached)(l,i,(function(n,i){if(!i)return injectedElements.splice(injectedElements.indexOf(e),1),e=null,void o(n);var s=e.getAttribute("id");s&&i.setAttribute("id",s);var u=e.getAttribute("title");u&&i.setAttribute("title",u);var c=e.getAttribute("width");c&&i.setAttribute("width",c);var d=e.getAttribute("height");d&&i.setAttribute("height",d);var f=Array.from(new Set(tslib.__spreadArray(tslib.__spreadArray(tslib.__spreadArray([],(i.getAttribute("class")||"").split(" "),!0),["injected-svg"],!1),(e.getAttribute("class")||"").split(" "),!0))).join(" ").trim();i.setAttribute("class",f);var p=e.getAttribute("style");p&&i.setAttribute("style",p),i.setAttribute("data-src",l);var v=[].filter.call(e.attributes,(function(e){return/^data-\w[\w-]*$/.test(e.name)}));if(Array.prototype.forEach.call(v,(function(e){e.name&&e.value&&i.setAttribute(e.name,e.value)})),r){var h,m,g,A,b={clipPath:["clip-path"],"color-profile":["color-profile"],cursor:["cursor"],filter:["filter"],linearGradient:["fill","stroke"],marker:["marker","marker-start","marker-mid","marker-end"],mask:["mask"],path:[],pattern:["fill","stroke"],radialGradient:["fill","stroke"]};Object.keys(b).forEach((function(e){m=b[e];for(var t=function(e,t){var r;A=(g=h[e].id)+"-"+uniqueId(),Array.prototype.forEach.call(m,(function(e){for(var t=0,n=(r=i.querySelectorAll("["+e+'*="'+g+'"]')).length;t<n;t++){var a=r[t].getAttribute(e);a&&!a.match(new RegExp('url\\("?#'+g+'"?\\)'))||r[t].setAttribute(e,"url(#"+A+")")}}));for(var n=i.querySelectorAll("[*|href]"),a=[],o=0,l=n.length;o<l;o++){var s=n[o].getAttributeNS(xlinkNamespace,"href");s&&s.toString()==="#"+h[e].id&&a.push(n[o])}for(var u=0,c=a.length;u<c;u++)a[u].setAttributeNS(xlinkNamespace,"href","#"+A);h[e].id=A},r=0,n=(h=i.querySelectorAll(e+"[id]")).length;r<n;r++)t(r)}))}i.removeAttribute("xmlns:a");for(var w,y,E=i.querySelectorAll("script"),S=[],q=0,j=E.length;q<j;q++)(y=E[q].getAttribute("type"))&&"application/ecmascript"!==y&&"application/javascript"!==y&&"text/javascript"!==y||((w=E[q].innerText||E[q].textContent)&&S.push(w),i.removeChild(E[q]));if(S.length>0&&("always"===t||"once"===t&&!ranScripts[l])){for(var x=0,k=S.length;x<k;x++)new Function(S[x])(window);ranScripts[l]=!0}var G=i.querySelectorAll("style");if(Array.prototype.forEach.call(G,(function(e){e.textContent+=""})),i.setAttribute("xmlns",svgNamespace),i.setAttribute("xmlns:xlink",xlinkNamespace),a(i),!e.parentNode)return injectedElements.splice(injectedElements.indexOf(e),1),e=null,void o(new Error("Parent node is null"));e.parentNode.replaceChild(i,e),injectedElements.splice(injectedElements.indexOf(e),1),e=null,o(null,i)}))}else o(new Error("Invalid data-src or src attribute"))},SVGInjector=function(e,t){var r=void 0===t?{}:t,n=r.afterAll,i=void 0===n?function(){}:n,a=r.afterEach,o=void 0===a?function(){}:a,l=r.beforeEach,s=void 0===l?function(){}:l,u=r.cacheRequests,c=void 0===u||u,d=r.evalScripts,f=void 0===d?"never":d,p=r.httpRequestWithCredentials,v=void 0!==p&&p,h=r.renumerateIRIElements,m=void 0===h||h;if(e&&"length"in e)for(var g=0,A=0,b=e.length;A<b;A++)injectElement(e[A],f,m,c,v,s,(function(t,r){o(t,r),e&&"length"in e&&e.length===++g&&i(g)}));else e?injectElement(e,f,m,c,v,s,(function(t,r){o(t,r),i(1),e=null})):i(0)};exports.SVGInjector=SVGInjector;


},{"content-type":4,"tslib":7}],4:[function(require,module,exports){
/*!
 * content-type
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * RegExp to match *( ";" parameter ) in RFC 7231 sec 3.1.1.1
 *
 * parameter     = token "=" ( token / quoted-string )
 * token         = 1*tchar
 * tchar         = "!" / "#" / "$" / "%" / "&" / "'" / "*"
 *               / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~"
 *               / DIGIT / ALPHA
 *               ; any VCHAR, except delimiters
 * quoted-string = DQUOTE *( qdtext / quoted-pair ) DQUOTE
 * qdtext        = HTAB / SP / %x21 / %x23-5B / %x5D-7E / obs-text
 * obs-text      = %x80-FF
 * quoted-pair   = "\" ( HTAB / SP / VCHAR / obs-text )
 */
var PARAM_REGEXP = /; *([!#$%&'*+.^_`|~0-9A-Za-z-]+) *= *("(?:[\u000b\u0020\u0021\u0023-\u005b\u005d-\u007e\u0080-\u00ff]|\\[\u000b\u0020-\u00ff])*"|[!#$%&'*+.^_`|~0-9A-Za-z-]+) */g // eslint-disable-line no-control-regex
var TEXT_REGEXP = /^[\u000b\u0020-\u007e\u0080-\u00ff]+$/ // eslint-disable-line no-control-regex
var TOKEN_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

/**
 * RegExp to match quoted-pair in RFC 7230 sec 3.2.6
 *
 * quoted-pair = "\" ( HTAB / SP / VCHAR / obs-text )
 * obs-text    = %x80-FF
 */
var QESC_REGEXP = /\\([\u000b\u0020-\u00ff])/g // eslint-disable-line no-control-regex

/**
 * RegExp to match chars that must be quoted-pair in RFC 7230 sec 3.2.6
 */
var QUOTE_REGEXP = /([\\"])/g

/**
 * RegExp to match type in RFC 7231 sec 3.1.1.1
 *
 * media-type = type "/" subtype
 * type       = token
 * subtype    = token
 */
var TYPE_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

/**
 * Module exports.
 * @public
 */

exports.format = format
exports.parse = parse

/**
 * Format object to media type.
 *
 * @param {object} obj
 * @return {string}
 * @public
 */

function format (obj) {
  if (!obj || typeof obj !== 'object') {
    throw new TypeError('argument obj is required')
  }

  var parameters = obj.parameters
  var type = obj.type

  if (!type || !TYPE_REGEXP.test(type)) {
    throw new TypeError('invalid type')
  }

  var string = type

  // append parameters
  if (parameters && typeof parameters === 'object') {
    var param
    var params = Object.keys(parameters).sort()

    for (var i = 0; i < params.length; i++) {
      param = params[i]

      if (!TOKEN_REGEXP.test(param)) {
        throw new TypeError('invalid parameter name')
      }

      string += '; ' + param + '=' + qstring(parameters[param])
    }
  }

  return string
}

/**
 * Parse media type to object.
 *
 * @param {string|object} string
 * @return {Object}
 * @public
 */

function parse (string) {
  if (!string) {
    throw new TypeError('argument string is required')
  }

  // support req/res-like objects as argument
  var header = typeof string === 'object'
    ? getcontenttype(string)
    : string

  if (typeof header !== 'string') {
    throw new TypeError('argument string is required to be a string')
  }

  var index = header.indexOf(';')
  var type = index !== -1
    ? header.slice(0, index).trim()
    : header.trim()

  if (!TYPE_REGEXP.test(type)) {
    throw new TypeError('invalid media type')
  }

  var obj = new ContentType(type.toLowerCase())

  // parse parameters
  if (index !== -1) {
    var key
    var match
    var value

    PARAM_REGEXP.lastIndex = index

    while ((match = PARAM_REGEXP.exec(header))) {
      if (match.index !== index) {
        throw new TypeError('invalid parameter format')
      }

      index += match[0].length
      key = match[1].toLowerCase()
      value = match[2]

      if (value.charCodeAt(0) === 0x22 /* " */) {
        // remove quotes
        value = value.slice(1, -1)

        // remove escapes
        if (value.indexOf('\\') !== -1) {
          value = value.replace(QESC_REGEXP, '$1')
        }
      }

      obj.parameters[key] = value
    }

    if (index !== header.length) {
      throw new TypeError('invalid parameter format')
    }
  }

  return obj
}

/**
 * Get content-type from req/res objects.
 *
 * @param {object}
 * @return {Object}
 * @private
 */

function getcontenttype (obj) {
  var header

  if (typeof obj.getHeader === 'function') {
    // res-like
    header = obj.getHeader('content-type')
  } else if (typeof obj.headers === 'object') {
    // req-like
    header = obj.headers && obj.headers['content-type']
  }

  if (typeof header !== 'string') {
    throw new TypeError('content-type header is missing from object')
  }

  return header
}

/**
 * Quote a string if necessary.
 *
 * @param {string} val
 * @return {string}
 * @private
 */

function qstring (val) {
  var str = String(val)

  // no need to quote tokens
  if (TOKEN_REGEXP.test(str)) {
    return str
  }

  if (str.length > 0 && !TEXT_REGEXP.test(str)) {
    throw new TypeError('invalid parameter value')
  }

  return '"' + str.replace(QUOTE_REGEXP, '\\$1') + '"'
}

/**
 * Class to represent a content type.
 * @private
 */
function ContentType (type) {
  this.parameters = Object.create(null)
  this.type = type
}

},{}],5:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],6:[function(require,module,exports){
/*! Sortable 1.15.1 - MIT | git://github.com/SortableJS/Sortable.git */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t=t||self).Sortable=e()}(this,function(){"use strict";function e(e,t){var n,o=Object.keys(e);return Object.getOwnPropertySymbols&&(n=Object.getOwnPropertySymbols(e),t&&(n=n.filter(function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable})),o.push.apply(o,n)),o}function N(o){for(var t=1;t<arguments.length;t++){var i=null!=arguments[t]?arguments[t]:{};t%2?e(Object(i),!0).forEach(function(t){var e,n;e=o,t=i[n=t],n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t}):Object.getOwnPropertyDescriptors?Object.defineProperties(o,Object.getOwnPropertyDescriptors(i)):e(Object(i)).forEach(function(t){Object.defineProperty(o,t,Object.getOwnPropertyDescriptor(i,t))})}return o}function o(t){return(o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}function a(){return(a=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var n,o=arguments[e];for(n in o)Object.prototype.hasOwnProperty.call(o,n)&&(t[n]=o[n])}return t}).apply(this,arguments)}function i(t,e){if(null==t)return{};var n,o=function(t,e){if(null==t)return{};for(var n,o={},i=Object.keys(t),r=0;r<i.length;r++)n=i[r],0<=e.indexOf(n)||(o[n]=t[n]);return o}(t,e);if(Object.getOwnPropertySymbols)for(var i=Object.getOwnPropertySymbols(t),r=0;r<i.length;r++)n=i[r],0<=e.indexOf(n)||Object.prototype.propertyIsEnumerable.call(t,n)&&(o[n]=t[n]);return o}function r(t){return function(t){if(Array.isArray(t))return l(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||function(t,e){if(t){if("string"==typeof t)return l(t,e);var n=Object.prototype.toString.call(t).slice(8,-1);return"Map"===(n="Object"===n&&t.constructor?t.constructor.name:n)||"Set"===n?Array.from(t):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?l(t,e):void 0}}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function l(t,e){(null==e||e>t.length)&&(e=t.length);for(var n=0,o=new Array(e);n<e;n++)o[n]=t[n];return o}function t(t){if("undefined"!=typeof window&&window.navigator)return!!navigator.userAgent.match(t)}var y=t(/(?:Trident.*rv[ :]?11\.|msie|iemobile|Windows Phone)/i),w=t(/Edge/i),s=t(/firefox/i),u=t(/safari/i)&&!t(/chrome/i)&&!t(/android/i),n=t(/iP(ad|od|hone)/i),c=t(/chrome/i)&&t(/android/i),d={capture:!1,passive:!1};function h(t,e,n){t.addEventListener(e,n,!y&&d)}function p(t,e,n){t.removeEventListener(e,n,!y&&d)}function f(t,e){if(e&&(">"===e[0]&&(e=e.substring(1)),t))try{if(t.matches)return t.matches(e);if(t.msMatchesSelector)return t.msMatchesSelector(e);if(t.webkitMatchesSelector)return t.webkitMatchesSelector(e)}catch(t){return}}function P(t,e,n,o){if(t){n=n||document;do{if(null!=e&&(">"!==e[0]||t.parentNode===n)&&f(t,e)||o&&t===n)return t}while(t!==n&&(t=(i=t).host&&i!==document&&i.host.nodeType?i.host:i.parentNode))}var i;return null}var g,m=/\s+/g;function k(t,e,n){var o;t&&e&&(t.classList?t.classList[n?"add":"remove"](e):(o=(" "+t.className+" ").replace(m," ").replace(" "+e+" "," "),t.className=(o+(n?" "+e:"")).replace(m," ")))}function R(t,e,n){var o=t&&t.style;if(o){if(void 0===n)return document.defaultView&&document.defaultView.getComputedStyle?n=document.defaultView.getComputedStyle(t,""):t.currentStyle&&(n=t.currentStyle),void 0===e?n:n[e];o[e=!(e in o||-1!==e.indexOf("webkit"))?"-webkit-"+e:e]=n+("string"==typeof n?"":"px")}}function v(t,e){var n="";if("string"==typeof t)n=t;else do{var o=R(t,"transform")}while(o&&"none"!==o&&(n=o+" "+n),!e&&(t=t.parentNode));var i=window.DOMMatrix||window.WebKitCSSMatrix||window.CSSMatrix||window.MSCSSMatrix;return i&&new i(n)}function b(t,e,n){if(t){var o=t.getElementsByTagName(e),i=0,r=o.length;if(n)for(;i<r;i++)n(o[i],i);return o}return[]}function O(){var t=document.scrollingElement;return t||document.documentElement}function X(t,e,n,o,i){if(t.getBoundingClientRect||t===window){var r,a,l,s,c,u,d=t!==window&&t.parentNode&&t!==O()?(a=(r=t.getBoundingClientRect()).top,l=r.left,s=r.bottom,c=r.right,u=r.height,r.width):(l=a=0,s=window.innerHeight,c=window.innerWidth,u=window.innerHeight,window.innerWidth);if((e||n)&&t!==window&&(i=i||t.parentNode,!y))do{if(i&&i.getBoundingClientRect&&("none"!==R(i,"transform")||n&&"static"!==R(i,"position"))){var h=i.getBoundingClientRect();a-=h.top+parseInt(R(i,"border-top-width")),l-=h.left+parseInt(R(i,"border-left-width")),s=a+r.height,c=l+r.width;break}}while(i=i.parentNode);return o&&t!==window&&(o=(e=v(i||t))&&e.a,t=e&&e.d,e&&(s=(a/=t)+(u/=t),c=(l/=o)+(d/=o))),{top:a,left:l,bottom:s,right:c,width:d,height:u}}}function Y(t){var e=X(t),n=parseInt(R(t,"padding-left")),o=parseInt(R(t,"padding-top")),i=parseInt(R(t,"padding-right")),r=parseInt(R(t,"padding-bottom"));return e.top+=o+parseInt(R(t,"border-top-width")),e.left+=n+parseInt(R(t,"border-left-width")),e.width=t.clientWidth-n-i,e.height=t.clientHeight-o-r,e.bottom=e.top+e.height,e.right=e.left+e.width,e}function B(t,e,n){for(var o=A(t,!0),i=X(t)[e];o;){var r=X(o)[n];if(!("top"===n||"left"===n?r<=i:i<=r))return o;if(o===O())break;o=A(o,!1)}return!1}function F(t,e,n,o){for(var i=0,r=0,a=t.children;r<a.length;){if("none"!==a[r].style.display&&a[r]!==Ft.ghost&&(o||a[r]!==Ft.dragged)&&P(a[r],n.draggable,t,!1)){if(i===e)return a[r];i++}r++}return null}function j(t,e){for(var n=t.lastElementChild;n&&(n===Ft.ghost||"none"===R(n,"display")||e&&!f(n,e));)n=n.previousElementSibling;return n||null}function H(t,e){var n=0;if(!t||!t.parentNode)return-1;for(;t=t.previousElementSibling;)"TEMPLATE"===t.nodeName.toUpperCase()||t===Ft.clone||e&&!f(t,e)||n++;return n}function E(t){var e=0,n=0,o=O();if(t)do{var i=v(t),r=i.a,i=i.d}while(e+=t.scrollLeft*r,n+=t.scrollTop*i,t!==o&&(t=t.parentNode));return[e,n]}function A(t,e){if(!t||!t.getBoundingClientRect)return O();var n=t,o=!1;do{if(n.clientWidth<n.scrollWidth||n.clientHeight<n.scrollHeight){var i=R(n);if(n.clientWidth<n.scrollWidth&&("auto"==i.overflowX||"scroll"==i.overflowX)||n.clientHeight<n.scrollHeight&&("auto"==i.overflowY||"scroll"==i.overflowY)){if(!n.getBoundingClientRect||n===document.body)return O();if(o||e)return n;o=!0}}}while(n=n.parentNode);return O()}function D(t,e){return Math.round(t.top)===Math.round(e.top)&&Math.round(t.left)===Math.round(e.left)&&Math.round(t.height)===Math.round(e.height)&&Math.round(t.width)===Math.round(e.width)}function S(e,n){return function(){var t;g||(1===(t=arguments).length?e.call(this,t[0]):e.apply(this,t),g=setTimeout(function(){g=void 0},n))}}function L(t,e,n){t.scrollLeft+=e,t.scrollTop+=n}function _(t){var e=window.Polymer,n=window.jQuery||window.Zepto;return e&&e.dom?e.dom(t).cloneNode(!0):n?n(t).clone(!0)[0]:t.cloneNode(!0)}function C(t,e){R(t,"position","absolute"),R(t,"top",e.top),R(t,"left",e.left),R(t,"width",e.width),R(t,"height",e.height)}function T(t){R(t,"position",""),R(t,"top",""),R(t,"left",""),R(t,"width",""),R(t,"height","")}var W="Sortable"+(new Date).getTime();function x(){var e,o=[];return{captureAnimationState:function(){o=[],this.options.animation&&[].slice.call(this.el.children).forEach(function(t){var e,n;"none"!==R(t,"display")&&t!==Ft.ghost&&(o.push({target:t,rect:X(t)}),e=N({},o[o.length-1].rect),!t.thisAnimationDuration||(n=v(t,!0))&&(e.top-=n.f,e.left-=n.e),t.fromRect=e)})},addAnimationState:function(t){o.push(t)},removeAnimationState:function(t){o.splice(function(t,e){for(var n in t)if(t.hasOwnProperty(n))for(var o in e)if(e.hasOwnProperty(o)&&e[o]===t[n][o])return Number(n);return-1}(o,{target:t}),1)},animateAll:function(t){var c=this;if(!this.options.animation)return clearTimeout(e),void("function"==typeof t&&t());var u=!1,d=0;o.forEach(function(t){var e=0,n=t.target,o=n.fromRect,i=X(n),r=n.prevFromRect,a=n.prevToRect,l=t.rect,s=v(n,!0);s&&(i.top-=s.f,i.left-=s.e),n.toRect=i,n.thisAnimationDuration&&D(r,i)&&!D(o,i)&&(l.top-i.top)/(l.left-i.left)==(o.top-i.top)/(o.left-i.left)&&(t=l,s=r,r=a,a=c.options,e=Math.sqrt(Math.pow(s.top-t.top,2)+Math.pow(s.left-t.left,2))/Math.sqrt(Math.pow(s.top-r.top,2)+Math.pow(s.left-r.left,2))*a.animation),D(i,o)||(n.prevFromRect=o,n.prevToRect=i,e=e||c.options.animation,c.animate(n,l,i,e)),e&&(u=!0,d=Math.max(d,e),clearTimeout(n.animationResetTimer),n.animationResetTimer=setTimeout(function(){n.animationTime=0,n.prevFromRect=null,n.fromRect=null,n.prevToRect=null,n.thisAnimationDuration=null},e),n.thisAnimationDuration=e)}),clearTimeout(e),u?e=setTimeout(function(){"function"==typeof t&&t()},d):"function"==typeof t&&t(),o=[]},animate:function(t,e,n,o){var i,r;o&&(R(t,"transition",""),R(t,"transform",""),i=(r=v(this.el))&&r.a,r=r&&r.d,i=(e.left-n.left)/(i||1),r=(e.top-n.top)/(r||1),t.animatingX=!!i,t.animatingY=!!r,R(t,"transform","translate3d("+i+"px,"+r+"px,0)"),this.forRepaintDummy=t.offsetWidth,R(t,"transition","transform "+o+"ms"+(this.options.easing?" "+this.options.easing:"")),R(t,"transform","translate3d(0,0,0)"),"number"==typeof t.animated&&clearTimeout(t.animated),t.animated=setTimeout(function(){R(t,"transition",""),R(t,"transform",""),t.animated=!1,t.animatingX=!1,t.animatingY=!1},o))}}}var M=[],I={initializeByDefault:!0},K={mount:function(e){for(var t in I)!I.hasOwnProperty(t)||t in e||(e[t]=I[t]);M.forEach(function(t){if(t.pluginName===e.pluginName)throw"Sortable: Cannot mount plugin ".concat(e.pluginName," more than once")}),M.push(e)},pluginEvent:function(e,n,o){var t=this;this.eventCanceled=!1,o.cancel=function(){t.eventCanceled=!0};var i=e+"Global";M.forEach(function(t){n[t.pluginName]&&(n[t.pluginName][i]&&n[t.pluginName][i](N({sortable:n},o)),n.options[t.pluginName]&&n[t.pluginName][e]&&n[t.pluginName][e](N({sortable:n},o)))})},initializePlugins:function(n,o,i,t){for(var e in M.forEach(function(t){var e=t.pluginName;(n.options[e]||t.initializeByDefault)&&((t=new t(n,o,n.options)).sortable=n,t.options=n.options,n[e]=t,a(i,t.defaults))}),n.options){var r;n.options.hasOwnProperty(e)&&(void 0!==(r=this.modifyOption(n,e,n.options[e]))&&(n.options[e]=r))}},getEventProperties:function(e,n){var o={};return M.forEach(function(t){"function"==typeof t.eventProperties&&a(o,t.eventProperties.call(n[t.pluginName],e))}),o},modifyOption:function(e,n,o){var i;return M.forEach(function(t){e[t.pluginName]&&t.optionListeners&&"function"==typeof t.optionListeners[n]&&(i=t.optionListeners[n].call(e[t.pluginName],o))}),i}};function z(t){var e=t.sortable,n=t.rootEl,o=t.name,i=t.targetEl,r=t.cloneEl,a=t.toEl,l=t.fromEl,s=t.oldIndex,c=t.newIndex,u=t.oldDraggableIndex,d=t.newDraggableIndex,h=t.originalEvent,p=t.putSortable,f=t.extraEventProperties;if(e=e||n&&n[W]){var g,m=e.options,t="on"+o.charAt(0).toUpperCase()+o.substr(1);!window.CustomEvent||y||w?(g=document.createEvent("Event")).initEvent(o,!0,!0):g=new CustomEvent(o,{bubbles:!0,cancelable:!0}),g.to=a||n,g.from=l||n,g.item=i||n,g.clone=r,g.oldIndex=s,g.newIndex=c,g.oldDraggableIndex=u,g.newDraggableIndex=d,g.originalEvent=h,g.pullMode=p?p.lastPutMode:void 0;var v,b=N(N({},f),K.getEventProperties(o,e));for(v in b)g[v]=b[v];n&&n.dispatchEvent(g),m[t]&&m[t].call(e,g)}}function G(t,e){var n=(o=2<arguments.length&&void 0!==arguments[2]?arguments[2]:{}).evt,o=i(o,U);K.pluginEvent.bind(Ft)(t,e,N({dragEl:V,parentEl:Z,ghostEl:$,rootEl:Q,nextEl:J,lastDownEl:tt,cloneEl:et,cloneHidden:nt,dragStarted:gt,putSortable:st,activeSortable:Ft.active,originalEvent:n,oldIndex:ot,oldDraggableIndex:rt,newIndex:it,newDraggableIndex:at,hideGhostForTarget:Rt,unhideGhostForTarget:Xt,cloneNowHidden:function(){nt=!0},cloneNowShown:function(){nt=!1},dispatchSortableEvent:function(t){q({sortable:e,name:t,originalEvent:n})}},o))}var U=["evt"];function q(t){z(N({putSortable:st,cloneEl:et,targetEl:V,rootEl:Q,oldIndex:ot,oldDraggableIndex:rt,newIndex:it,newDraggableIndex:at},t))}var V,Z,$,Q,J,tt,et,nt,ot,it,rt,at,lt,st,ct,ut,dt,ht,pt,ft,gt,mt,vt,bt,yt,wt=!1,Et=!1,Dt=[],St=!1,_t=!1,Ct=[],Tt=!1,xt=[],Ot="undefined"!=typeof document,At=n,Mt=w||y?"cssFloat":"float",It=Ot&&!c&&!n&&"draggable"in document.createElement("div"),Nt=function(){if(Ot){if(y)return!1;var t=document.createElement("x");return t.style.cssText="pointer-events:auto","auto"===t.style.pointerEvents}}(),Pt=function(t,e){var n=R(t),o=parseInt(n.width)-parseInt(n.paddingLeft)-parseInt(n.paddingRight)-parseInt(n.borderLeftWidth)-parseInt(n.borderRightWidth),i=F(t,0,e),r=F(t,1,e),a=i&&R(i),l=r&&R(r),s=a&&parseInt(a.marginLeft)+parseInt(a.marginRight)+X(i).width,t=l&&parseInt(l.marginLeft)+parseInt(l.marginRight)+X(r).width;if("flex"===n.display)return"column"===n.flexDirection||"column-reverse"===n.flexDirection?"vertical":"horizontal";if("grid"===n.display)return n.gridTemplateColumns.split(" ").length<=1?"vertical":"horizontal";if(i&&a.float&&"none"!==a.float){e="left"===a.float?"left":"right";return!r||"both"!==l.clear&&l.clear!==e?"horizontal":"vertical"}return i&&("block"===a.display||"flex"===a.display||"table"===a.display||"grid"===a.display||o<=s&&"none"===n[Mt]||r&&"none"===n[Mt]&&o<s+t)?"vertical":"horizontal"},kt=function(t){function l(r,a){return function(t,e,n,o){var i=t.options.group.name&&e.options.group.name&&t.options.group.name===e.options.group.name;if(null==r&&(a||i))return!0;if(null==r||!1===r)return!1;if(a&&"clone"===r)return r;if("function"==typeof r)return l(r(t,e,n,o),a)(t,e,n,o);e=(a?t:e).options.group.name;return!0===r||"string"==typeof r&&r===e||r.join&&-1<r.indexOf(e)}}var e={},n=t.group;n&&"object"==o(n)||(n={name:n}),e.name=n.name,e.checkPull=l(n.pull,!0),e.checkPut=l(n.put),e.revertClone=n.revertClone,t.group=e},Rt=function(){!Nt&&$&&R($,"display","none")},Xt=function(){!Nt&&$&&R($,"display","")};Ot&&!c&&document.addEventListener("click",function(t){if(Et)return t.preventDefault(),t.stopPropagation&&t.stopPropagation(),t.stopImmediatePropagation&&t.stopImmediatePropagation(),Et=!1},!0);function Yt(t){if(V){t=t.touches?t.touches[0]:t;var e=(i=t.clientX,r=t.clientY,Dt.some(function(t){var e=t[W].options.emptyInsertThreshold;if(e&&!j(t)){var n=X(t),o=i>=n.left-e&&i<=n.right+e,e=r>=n.top-e&&r<=n.bottom+e;return o&&e?a=t:void 0}}),a);if(e){var n,o={};for(n in t)t.hasOwnProperty(n)&&(o[n]=t[n]);o.target=o.rootEl=e,o.preventDefault=void 0,o.stopPropagation=void 0,e[W]._onDragOver(o)}}var i,r,a}function Bt(t){V&&V.parentNode[W]._isOutsideThisEl(t.target)}function Ft(t,e){if(!t||!t.nodeType||1!==t.nodeType)throw"Sortable: `el` must be an HTMLElement, not ".concat({}.toString.call(t));this.el=t,this.options=e=a({},e),t[W]=this;var n,o,i={group:null,sort:!0,disabled:!1,store:null,handle:null,draggable:/^[uo]l$/i.test(t.nodeName)?">li":">*",swapThreshold:1,invertSwap:!1,invertedSwapThreshold:null,removeCloneOnHide:!0,direction:function(){return Pt(t,this.options)},ghostClass:"sortable-ghost",chosenClass:"sortable-chosen",dragClass:"sortable-drag",ignore:"a, img",filter:null,preventOnFilter:!0,animation:0,easing:null,setData:function(t,e){t.setData("Text",e.textContent)},dropBubble:!1,dragoverBubble:!1,dataIdAttr:"data-id",delay:0,delayOnTouchOnly:!1,touchStartThreshold:(Number.parseInt?Number:window).parseInt(window.devicePixelRatio,10)||1,forceFallback:!1,fallbackClass:"sortable-fallback",fallbackOnBody:!1,fallbackTolerance:0,fallbackOffset:{x:0,y:0},supportPointer:!1!==Ft.supportPointer&&"PointerEvent"in window&&!u,emptyInsertThreshold:5};for(n in K.initializePlugins(this,t,i),i)n in e||(e[n]=i[n]);for(o in kt(e),this)"_"===o.charAt(0)&&"function"==typeof this[o]&&(this[o]=this[o].bind(this));this.nativeDraggable=!e.forceFallback&&It,this.nativeDraggable&&(this.options.touchStartThreshold=1),e.supportPointer?h(t,"pointerdown",this._onTapStart):(h(t,"mousedown",this._onTapStart),h(t,"touchstart",this._onTapStart)),this.nativeDraggable&&(h(t,"dragover",this),h(t,"dragenter",this)),Dt.push(this.el),e.store&&e.store.get&&this.sort(e.store.get(this)||[]),a(this,x())}function jt(t,e,n,o,i,r,a,l){var s,c,u=t[W],d=u.options.onMove;return!window.CustomEvent||y||w?(s=document.createEvent("Event")).initEvent("move",!0,!0):s=new CustomEvent("move",{bubbles:!0,cancelable:!0}),s.to=e,s.from=t,s.dragged=n,s.draggedRect=o,s.related=i||e,s.relatedRect=r||X(e),s.willInsertAfter=l,s.originalEvent=a,t.dispatchEvent(s),c=d?d.call(u,s,a):c}function Ht(t){t.draggable=!1}function Lt(){Tt=!1}function Wt(t){return setTimeout(t,0)}function Kt(t){return clearTimeout(t)}Ft.prototype={constructor:Ft,_isOutsideThisEl:function(t){this.el.contains(t)||t===this.el||(mt=null)},_getDirection:function(t,e){return"function"==typeof this.options.direction?this.options.direction.call(this,t,e,V):this.options.direction},_onTapStart:function(e){if(e.cancelable){var n=this,o=this.el,t=this.options,i=t.preventOnFilter,r=e.type,a=e.touches&&e.touches[0]||e.pointerType&&"touch"===e.pointerType&&e,l=(a||e).target,s=e.target.shadowRoot&&(e.path&&e.path[0]||e.composedPath&&e.composedPath()[0])||l,c=t.filter;if(!function(t){xt.length=0;var e=t.getElementsByTagName("input"),n=e.length;for(;n--;){var o=e[n];o.checked&&xt.push(o)}}(o),!V&&!(/mousedown|pointerdown/.test(r)&&0!==e.button||t.disabled)&&!s.isContentEditable&&(this.nativeDraggable||!u||!l||"SELECT"!==l.tagName.toUpperCase())&&!((l=P(l,t.draggable,o,!1))&&l.animated||tt===l)){if(ot=H(l),rt=H(l,t.draggable),"function"==typeof c){if(c.call(this,e,l,this))return q({sortable:n,rootEl:s,name:"filter",targetEl:l,toEl:o,fromEl:o}),G("filter",n,{evt:e}),void(i&&e.cancelable&&e.preventDefault())}else if(c=c&&c.split(",").some(function(t){if(t=P(s,t.trim(),o,!1))return q({sortable:n,rootEl:t,name:"filter",targetEl:l,fromEl:o,toEl:o}),G("filter",n,{evt:e}),!0}))return void(i&&e.cancelable&&e.preventDefault());t.handle&&!P(s,t.handle,o,!1)||this._prepareDragStart(e,a,l)}}},_prepareDragStart:function(t,e,n){var o,i=this,r=i.el,a=i.options,l=r.ownerDocument;n&&!V&&n.parentNode===r&&(o=X(n),Q=r,Z=(V=n).parentNode,J=V.nextSibling,tt=n,lt=a.group,ct={target:Ft.dragged=V,clientX:(e||t).clientX,clientY:(e||t).clientY},pt=ct.clientX-o.left,ft=ct.clientY-o.top,this._lastX=(e||t).clientX,this._lastY=(e||t).clientY,V.style["will-change"]="all",o=function(){G("delayEnded",i,{evt:t}),Ft.eventCanceled?i._onDrop():(i._disableDelayedDragEvents(),!s&&i.nativeDraggable&&(V.draggable=!0),i._triggerDragStart(t,e),q({sortable:i,name:"choose",originalEvent:t}),k(V,a.chosenClass,!0))},a.ignore.split(",").forEach(function(t){b(V,t.trim(),Ht)}),h(l,"dragover",Yt),h(l,"mousemove",Yt),h(l,"touchmove",Yt),h(l,"mouseup",i._onDrop),h(l,"touchend",i._onDrop),h(l,"touchcancel",i._onDrop),s&&this.nativeDraggable&&(this.options.touchStartThreshold=4,V.draggable=!0),G("delayStart",this,{evt:t}),!a.delay||a.delayOnTouchOnly&&!e||this.nativeDraggable&&(w||y)?o():Ft.eventCanceled?this._onDrop():(h(l,"mouseup",i._disableDelayedDrag),h(l,"touchend",i._disableDelayedDrag),h(l,"touchcancel",i._disableDelayedDrag),h(l,"mousemove",i._delayedDragTouchMoveHandler),h(l,"touchmove",i._delayedDragTouchMoveHandler),a.supportPointer&&h(l,"pointermove",i._delayedDragTouchMoveHandler),i._dragStartTimer=setTimeout(o,a.delay)))},_delayedDragTouchMoveHandler:function(t){t=t.touches?t.touches[0]:t;Math.max(Math.abs(t.clientX-this._lastX),Math.abs(t.clientY-this._lastY))>=Math.floor(this.options.touchStartThreshold/(this.nativeDraggable&&window.devicePixelRatio||1))&&this._disableDelayedDrag()},_disableDelayedDrag:function(){V&&Ht(V),clearTimeout(this._dragStartTimer),this._disableDelayedDragEvents()},_disableDelayedDragEvents:function(){var t=this.el.ownerDocument;p(t,"mouseup",this._disableDelayedDrag),p(t,"touchend",this._disableDelayedDrag),p(t,"touchcancel",this._disableDelayedDrag),p(t,"mousemove",this._delayedDragTouchMoveHandler),p(t,"touchmove",this._delayedDragTouchMoveHandler),p(t,"pointermove",this._delayedDragTouchMoveHandler)},_triggerDragStart:function(t,e){e=e||"touch"==t.pointerType&&t,!this.nativeDraggable||e?this.options.supportPointer?h(document,"pointermove",this._onTouchMove):h(document,e?"touchmove":"mousemove",this._onTouchMove):(h(V,"dragend",this),h(Q,"dragstart",this._onDragStart));try{document.selection?Wt(function(){document.selection.empty()}):window.getSelection().removeAllRanges()}catch(t){}},_dragStarted:function(t,e){var n;wt=!1,Q&&V?(G("dragStarted",this,{evt:e}),this.nativeDraggable&&h(document,"dragover",Bt),n=this.options,t||k(V,n.dragClass,!1),k(V,n.ghostClass,!0),Ft.active=this,t&&this._appendGhost(),q({sortable:this,name:"start",originalEvent:e})):this._nulling()},_emulateDragOver:function(){if(ut){this._lastX=ut.clientX,this._lastY=ut.clientY,Rt();for(var t=document.elementFromPoint(ut.clientX,ut.clientY),e=t;t&&t.shadowRoot&&(t=t.shadowRoot.elementFromPoint(ut.clientX,ut.clientY))!==e;)e=t;if(V.parentNode[W]._isOutsideThisEl(t),e)do{if(e[W])if(e[W]._onDragOver({clientX:ut.clientX,clientY:ut.clientY,target:t,rootEl:e})&&!this.options.dragoverBubble)break}while(e=(t=e).parentNode);Xt()}},_onTouchMove:function(t){if(ct){var e=this.options,n=e.fallbackTolerance,o=e.fallbackOffset,i=t.touches?t.touches[0]:t,r=$&&v($,!0),a=$&&r&&r.a,l=$&&r&&r.d,e=At&&yt&&E(yt),a=(i.clientX-ct.clientX+o.x)/(a||1)+(e?e[0]-Ct[0]:0)/(a||1),l=(i.clientY-ct.clientY+o.y)/(l||1)+(e?e[1]-Ct[1]:0)/(l||1);if(!Ft.active&&!wt){if(n&&Math.max(Math.abs(i.clientX-this._lastX),Math.abs(i.clientY-this._lastY))<n)return;this._onDragStart(t,!0)}$&&(r?(r.e+=a-(dt||0),r.f+=l-(ht||0)):r={a:1,b:0,c:0,d:1,e:a,f:l},r="matrix(".concat(r.a,",").concat(r.b,",").concat(r.c,",").concat(r.d,",").concat(r.e,",").concat(r.f,")"),R($,"webkitTransform",r),R($,"mozTransform",r),R($,"msTransform",r),R($,"transform",r),dt=a,ht=l,ut=i),t.cancelable&&t.preventDefault()}},_appendGhost:function(){if(!$){var t=this.options.fallbackOnBody?document.body:Q,e=X(V,!0,At,!0,t),n=this.options;if(At){for(yt=t;"static"===R(yt,"position")&&"none"===R(yt,"transform")&&yt!==document;)yt=yt.parentNode;yt!==document.body&&yt!==document.documentElement?(yt===document&&(yt=O()),e.top+=yt.scrollTop,e.left+=yt.scrollLeft):yt=O(),Ct=E(yt)}k($=V.cloneNode(!0),n.ghostClass,!1),k($,n.fallbackClass,!0),k($,n.dragClass,!0),R($,"transition",""),R($,"transform",""),R($,"box-sizing","border-box"),R($,"margin",0),R($,"top",e.top),R($,"left",e.left),R($,"width",e.width),R($,"height",e.height),R($,"opacity","0.8"),R($,"position",At?"absolute":"fixed"),R($,"zIndex","100000"),R($,"pointerEvents","none"),Ft.ghost=$,t.appendChild($),R($,"transform-origin",pt/parseInt($.style.width)*100+"% "+ft/parseInt($.style.height)*100+"%")}},_onDragStart:function(t,e){var n=this,o=t.dataTransfer,i=n.options;G("dragStart",this,{evt:t}),Ft.eventCanceled?this._onDrop():(G("setupClone",this),Ft.eventCanceled||((et=_(V)).removeAttribute("id"),et.draggable=!1,et.style["will-change"]="",this._hideClone(),k(et,this.options.chosenClass,!1),Ft.clone=et),n.cloneId=Wt(function(){G("clone",n),Ft.eventCanceled||(n.options.removeCloneOnHide||Q.insertBefore(et,V),n._hideClone(),q({sortable:n,name:"clone"}))}),e||k(V,i.dragClass,!0),e?(Et=!0,n._loopId=setInterval(n._emulateDragOver,50)):(p(document,"mouseup",n._onDrop),p(document,"touchend",n._onDrop),p(document,"touchcancel",n._onDrop),o&&(o.effectAllowed="move",i.setData&&i.setData.call(n,o,V)),h(document,"drop",n),R(V,"transform","translateZ(0)")),wt=!0,n._dragStartId=Wt(n._dragStarted.bind(n,e,t)),h(document,"selectstart",n),gt=!0,u&&R(document.body,"user-select","none"))},_onDragOver:function(n){var o,i,r,t,e,a=this.el,l=n.target,s=this.options,c=s.group,u=Ft.active,d=lt===c,h=s.sort,p=st||u,f=this,g=!1;if(!Tt){if(void 0!==n.preventDefault&&n.cancelable&&n.preventDefault(),l=P(l,s.draggable,a,!0),O("dragOver"),Ft.eventCanceled)return g;if(V.contains(n.target)||l.animated&&l.animatingX&&l.animatingY||f._ignoreWhileAnimating===l)return M(!1);if(Et=!1,u&&!s.disabled&&(d?h||(i=Z!==Q):st===this||(this.lastPutMode=lt.checkPull(this,u,V,n))&&c.checkPut(this,u,V,n))){if(r="vertical"===this._getDirection(n,l),o=X(V),O("dragOverValid"),Ft.eventCanceled)return g;if(i)return Z=Q,A(),this._hideClone(),O("revert"),Ft.eventCanceled||(J?Q.insertBefore(V,J):Q.appendChild(V)),M(!0);var m=j(a,s.draggable);if(m&&(S=n,c=r,x=X(j((D=this).el,D.options.draggable)),D=Y(D.el),!(c?S.clientX>D.right+10||S.clientY>x.bottom&&S.clientX>x.left:S.clientY>D.bottom+10||S.clientX>x.right&&S.clientY>x.top)||m.animated)){if(m&&(t=n,e=r,C=X(F((_=this).el,0,_.options,!0)),_=Y(_.el),e?t.clientX<_.left-10||t.clientY<C.top&&t.clientX<C.right:t.clientY<_.top-10||t.clientY<C.bottom&&t.clientX<C.left)){var v=F(a,0,s,!0);if(v===V)return M(!1);if(E=X(l=v),!1!==jt(Q,a,V,o,l,E,n,!1))return A(),a.insertBefore(V,v),Z=a,I(),M(!0)}else if(l.parentNode===a){var b,y,w,E=X(l),D=V.parentNode!==a,S=(S=V.animated&&V.toRect||o,x=l.animated&&l.toRect||E,_=(e=r)?S.left:S.top,t=e?S.right:S.bottom,C=e?S.width:S.height,v=e?x.left:x.top,S=e?x.right:x.bottom,x=e?x.width:x.height,!(_===v||t===S||_+C/2===v+x/2)),_=r?"top":"left",C=B(l,"top","top")||B(V,"top","top"),v=C?C.scrollTop:void 0;if(mt!==l&&(y=E[_],St=!1,_t=!S&&s.invertSwap||D),0!==(b=function(t,e,n,o,i,r,a,l){var s=o?t.clientY:t.clientX,c=o?n.height:n.width,t=o?n.top:n.left,o=o?n.bottom:n.right,n=!1;if(!a)if(l&&bt<c*i){if(St=!St&&(1===vt?t+c*r/2<s:s<o-c*r/2)?!0:St)n=!0;else if(1===vt?s<t+bt:o-bt<s)return-vt}else if(t+c*(1-i)/2<s&&s<o-c*(1-i)/2)return function(t){return H(V)<H(t)?1:-1}(e);if((n=n||a)&&(s<t+c*r/2||o-c*r/2<s))return t+c/2<s?1:-1;return 0}(n,l,E,r,S?1:s.swapThreshold,null==s.invertedSwapThreshold?s.swapThreshold:s.invertedSwapThreshold,_t,mt===l)))for(var T=H(V);(w=Z.children[T-=b])&&("none"===R(w,"display")||w===$););if(0===b||w===l)return M(!1);vt=b;var x=(mt=l).nextElementSibling,D=!1,S=jt(Q,a,V,o,l,E,n,D=1===b);if(!1!==S)return 1!==S&&-1!==S||(D=1===S),Tt=!0,setTimeout(Lt,30),A(),D&&!x?a.appendChild(V):l.parentNode.insertBefore(V,D?x:l),C&&L(C,0,v-C.scrollTop),Z=V.parentNode,void 0===y||_t||(bt=Math.abs(y-X(l)[_])),I(),M(!0)}}else{if(m===V)return M(!1);if((l=m&&a===n.target?m:l)&&(E=X(l)),!1!==jt(Q,a,V,o,l,E,n,!!l))return A(),m&&m.nextSibling?a.insertBefore(V,m.nextSibling):a.appendChild(V),Z=a,I(),M(!0)}if(a.contains(V))return M(!1)}return!1}function O(t,e){G(t,f,N({evt:n,isOwner:d,axis:r?"vertical":"horizontal",revert:i,dragRect:o,targetRect:E,canSort:h,fromSortable:p,target:l,completed:M,onMove:function(t,e){return jt(Q,a,V,o,t,X(t),n,e)},changed:I},e))}function A(){O("dragOverAnimationCapture"),f.captureAnimationState(),f!==p&&p.captureAnimationState()}function M(t){return O("dragOverCompleted",{insertion:t}),t&&(d?u._hideClone():u._showClone(f),f!==p&&(k(V,(st||u).options.ghostClass,!1),k(V,s.ghostClass,!0)),st!==f&&f!==Ft.active?st=f:f===Ft.active&&st&&(st=null),p===f&&(f._ignoreWhileAnimating=l),f.animateAll(function(){O("dragOverAnimationComplete"),f._ignoreWhileAnimating=null}),f!==p&&(p.animateAll(),p._ignoreWhileAnimating=null)),(l===V&&!V.animated||l===a&&!l.animated)&&(mt=null),s.dragoverBubble||n.rootEl||l===document||(V.parentNode[W]._isOutsideThisEl(n.target),t||Yt(n)),!s.dragoverBubble&&n.stopPropagation&&n.stopPropagation(),g=!0}function I(){it=H(V),at=H(V,s.draggable),q({sortable:f,name:"change",toEl:a,newIndex:it,newDraggableIndex:at,originalEvent:n})}},_ignoreWhileAnimating:null,_offMoveEvents:function(){p(document,"mousemove",this._onTouchMove),p(document,"touchmove",this._onTouchMove),p(document,"pointermove",this._onTouchMove),p(document,"dragover",Yt),p(document,"mousemove",Yt),p(document,"touchmove",Yt)},_offUpEvents:function(){var t=this.el.ownerDocument;p(t,"mouseup",this._onDrop),p(t,"touchend",this._onDrop),p(t,"pointerup",this._onDrop),p(t,"touchcancel",this._onDrop),p(document,"selectstart",this)},_onDrop:function(t){var e=this.el,n=this.options;it=H(V),at=H(V,n.draggable),G("drop",this,{evt:t}),Z=V&&V.parentNode,it=H(V),at=H(V,n.draggable),Ft.eventCanceled||(St=_t=wt=!1,clearInterval(this._loopId),clearTimeout(this._dragStartTimer),Kt(this.cloneId),Kt(this._dragStartId),this.nativeDraggable&&(p(document,"drop",this),p(e,"dragstart",this._onDragStart)),this._offMoveEvents(),this._offUpEvents(),u&&R(document.body,"user-select",""),R(V,"transform",""),t&&(gt&&(t.cancelable&&t.preventDefault(),n.dropBubble||t.stopPropagation()),$&&$.parentNode&&$.parentNode.removeChild($),(Q===Z||st&&"clone"!==st.lastPutMode)&&et&&et.parentNode&&et.parentNode.removeChild(et),V&&(this.nativeDraggable&&p(V,"dragend",this),Ht(V),V.style["will-change"]="",gt&&!wt&&k(V,(st||this).options.ghostClass,!1),k(V,this.options.chosenClass,!1),q({sortable:this,name:"unchoose",toEl:Z,newIndex:null,newDraggableIndex:null,originalEvent:t}),Q!==Z?(0<=it&&(q({rootEl:Z,name:"add",toEl:Z,fromEl:Q,originalEvent:t}),q({sortable:this,name:"remove",toEl:Z,originalEvent:t}),q({rootEl:Z,name:"sort",toEl:Z,fromEl:Q,originalEvent:t}),q({sortable:this,name:"sort",toEl:Z,originalEvent:t})),st&&st.save()):it!==ot&&0<=it&&(q({sortable:this,name:"update",toEl:Z,originalEvent:t}),q({sortable:this,name:"sort",toEl:Z,originalEvent:t})),Ft.active&&(null!=it&&-1!==it||(it=ot,at=rt),q({sortable:this,name:"end",toEl:Z,originalEvent:t}),this.save())))),this._nulling()},_nulling:function(){G("nulling",this),Q=V=Z=$=J=et=tt=nt=ct=ut=gt=it=at=ot=rt=mt=vt=st=lt=Ft.dragged=Ft.ghost=Ft.clone=Ft.active=null,xt.forEach(function(t){t.checked=!0}),xt.length=dt=ht=0},handleEvent:function(t){switch(t.type){case"drop":case"dragend":this._onDrop(t);break;case"dragenter":case"dragover":V&&(this._onDragOver(t),function(t){t.dataTransfer&&(t.dataTransfer.dropEffect="move");t.cancelable&&t.preventDefault()}(t));break;case"selectstart":t.preventDefault()}},toArray:function(){for(var t,e=[],n=this.el.children,o=0,i=n.length,r=this.options;o<i;o++)P(t=n[o],r.draggable,this.el,!1)&&e.push(t.getAttribute(r.dataIdAttr)||function(t){var e=t.tagName+t.className+t.src+t.href+t.textContent,n=e.length,o=0;for(;n--;)o+=e.charCodeAt(n);return o.toString(36)}(t));return e},sort:function(t,e){var n={},o=this.el;this.toArray().forEach(function(t,e){e=o.children[e];P(e,this.options.draggable,o,!1)&&(n[t]=e)},this),e&&this.captureAnimationState(),t.forEach(function(t){n[t]&&(o.removeChild(n[t]),o.appendChild(n[t]))}),e&&this.animateAll()},save:function(){var t=this.options.store;t&&t.set&&t.set(this)},closest:function(t,e){return P(t,e||this.options.draggable,this.el,!1)},option:function(t,e){var n=this.options;if(void 0===e)return n[t];var o=K.modifyOption(this,t,e);n[t]=void 0!==o?o:e,"group"===t&&kt(n)},destroy:function(){G("destroy",this);var t=this.el;t[W]=null,p(t,"mousedown",this._onTapStart),p(t,"touchstart",this._onTapStart),p(t,"pointerdown",this._onTapStart),this.nativeDraggable&&(p(t,"dragover",this),p(t,"dragenter",this)),Array.prototype.forEach.call(t.querySelectorAll("[draggable]"),function(t){t.removeAttribute("draggable")}),this._onDrop(),this._disableDelayedDragEvents(),Dt.splice(Dt.indexOf(this.el),1),this.el=t=null},_hideClone:function(){nt||(G("hideClone",this),Ft.eventCanceled||(R(et,"display","none"),this.options.removeCloneOnHide&&et.parentNode&&et.parentNode.removeChild(et),nt=!0))},_showClone:function(t){"clone"===t.lastPutMode?nt&&(G("showClone",this),Ft.eventCanceled||(V.parentNode!=Q||this.options.group.revertClone?J?Q.insertBefore(et,J):Q.appendChild(et):Q.insertBefore(et,V),this.options.group.revertClone&&this.animate(V,et),R(et,"display",""),nt=!1)):this._hideClone()}},Ot&&h(document,"touchmove",function(t){(Ft.active||wt)&&t.cancelable&&t.preventDefault()}),Ft.utils={on:h,off:p,css:R,find:b,is:function(t,e){return!!P(t,e,t,!1)},extend:function(t,e){if(t&&e)for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n]);return t},throttle:S,closest:P,toggleClass:k,clone:_,index:H,nextTick:Wt,cancelNextTick:Kt,detectDirection:Pt,getChild:F},Ft.get=function(t){return t[W]},Ft.mount=function(){for(var t=arguments.length,e=new Array(t),n=0;n<t;n++)e[n]=arguments[n];(e=e[0].constructor===Array?e[0]:e).forEach(function(t){if(!t.prototype||!t.prototype.constructor)throw"Sortable: Mounted plugin must be a constructor function, not ".concat({}.toString.call(t));t.utils&&(Ft.utils=N(N({},Ft.utils),t.utils)),K.mount(t)})},Ft.create=function(t,e){return new Ft(t,e)};var zt,Gt,Ut,qt,Vt,Zt,$t=[],Qt=!(Ft.version="1.15.1");function Jt(){$t.forEach(function(t){clearInterval(t.pid)}),$t=[]}function te(){clearInterval(Zt)}var ee,ne=S(function(n,t,e,o){if(t.scroll){var i,r=(n.touches?n.touches[0]:n).clientX,a=(n.touches?n.touches[0]:n).clientY,l=t.scrollSensitivity,s=t.scrollSpeed,c=O(),u=!1;Gt!==e&&(Gt=e,Jt(),zt=t.scroll,i=t.scrollFn,!0===zt&&(zt=A(e,!0)));var d=0,h=zt;do{var p=h,f=X(p),g=f.top,m=f.bottom,v=f.left,b=f.right,y=f.width,w=f.height,E=void 0,D=void 0,S=p.scrollWidth,_=p.scrollHeight,C=R(p),T=p.scrollLeft,f=p.scrollTop,D=p===c?(E=y<S&&("auto"===C.overflowX||"scroll"===C.overflowX||"visible"===C.overflowX),w<_&&("auto"===C.overflowY||"scroll"===C.overflowY||"visible"===C.overflowY)):(E=y<S&&("auto"===C.overflowX||"scroll"===C.overflowX),w<_&&("auto"===C.overflowY||"scroll"===C.overflowY)),T=E&&(Math.abs(b-r)<=l&&T+y<S)-(Math.abs(v-r)<=l&&!!T),f=D&&(Math.abs(m-a)<=l&&f+w<_)-(Math.abs(g-a)<=l&&!!f);if(!$t[d])for(var x=0;x<=d;x++)$t[x]||($t[x]={});$t[d].vx==T&&$t[d].vy==f&&$t[d].el===p||($t[d].el=p,$t[d].vx=T,$t[d].vy=f,clearInterval($t[d].pid),0==T&&0==f||(u=!0,$t[d].pid=setInterval(function(){o&&0===this.layer&&Ft.active._onTouchMove(Vt);var t=$t[this.layer].vy?$t[this.layer].vy*s:0,e=$t[this.layer].vx?$t[this.layer].vx*s:0;"function"==typeof i&&"continue"!==i.call(Ft.dragged.parentNode[W],e,t,n,Vt,$t[this.layer].el)||L($t[this.layer].el,e,t)}.bind({layer:d}),24))),d++}while(t.bubbleScroll&&h!==c&&(h=A(h,!1)));Qt=u}},30),c=function(t){var e=t.originalEvent,n=t.putSortable,o=t.dragEl,i=t.activeSortable,r=t.dispatchSortableEvent,a=t.hideGhostForTarget,t=t.unhideGhostForTarget;e&&(i=n||i,a(),e=e.changedTouches&&e.changedTouches.length?e.changedTouches[0]:e,e=document.elementFromPoint(e.clientX,e.clientY),t(),i&&!i.el.contains(e)&&(r("spill"),this.onSpill({dragEl:o,putSortable:n})))};function oe(){}function ie(){}oe.prototype={startIndex:null,dragStart:function(t){t=t.oldDraggableIndex;this.startIndex=t},onSpill:function(t){var e=t.dragEl,n=t.putSortable;this.sortable.captureAnimationState(),n&&n.captureAnimationState();t=F(this.sortable.el,this.startIndex,this.options);t?this.sortable.el.insertBefore(e,t):this.sortable.el.appendChild(e),this.sortable.animateAll(),n&&n.animateAll()},drop:c},a(oe,{pluginName:"revertOnSpill"}),ie.prototype={onSpill:function(t){var e=t.dragEl,t=t.putSortable||this.sortable;t.captureAnimationState(),e.parentNode&&e.parentNode.removeChild(e),t.animateAll()},drop:c},a(ie,{pluginName:"removeOnSpill"});var re,ae,le,se,ce,ue=[],de=[],he=!1,pe=!1,fe=!1;function ge(n,o){de.forEach(function(t,e){e=o.children[t.sortableIndex+(n?Number(e):0)];e?o.insertBefore(t,e):o.appendChild(t)})}function me(){ue.forEach(function(t){t!==le&&t.parentNode&&t.parentNode.removeChild(t)})}return Ft.mount(new function(){function t(){for(var t in this.defaults={scroll:!0,forceAutoScrollFallback:!1,scrollSensitivity:30,scrollSpeed:10,bubbleScroll:!0},this)"_"===t.charAt(0)&&"function"==typeof this[t]&&(this[t]=this[t].bind(this))}return t.prototype={dragStarted:function(t){t=t.originalEvent;this.sortable.nativeDraggable?h(document,"dragover",this._handleAutoScroll):this.options.supportPointer?h(document,"pointermove",this._handleFallbackAutoScroll):t.touches?h(document,"touchmove",this._handleFallbackAutoScroll):h(document,"mousemove",this._handleFallbackAutoScroll)},dragOverCompleted:function(t){t=t.originalEvent;this.options.dragOverBubble||t.rootEl||this._handleAutoScroll(t)},drop:function(){this.sortable.nativeDraggable?p(document,"dragover",this._handleAutoScroll):(p(document,"pointermove",this._handleFallbackAutoScroll),p(document,"touchmove",this._handleFallbackAutoScroll),p(document,"mousemove",this._handleFallbackAutoScroll)),te(),Jt(),clearTimeout(g),g=void 0},nulling:function(){Vt=Gt=zt=Qt=Zt=Ut=qt=null,$t.length=0},_handleFallbackAutoScroll:function(t){this._handleAutoScroll(t,!0)},_handleAutoScroll:function(e,n){var o,i=this,r=(e.touches?e.touches[0]:e).clientX,a=(e.touches?e.touches[0]:e).clientY,t=document.elementFromPoint(r,a);Vt=e,n||this.options.forceAutoScrollFallback||w||y||u?(ne(e,this.options,t,n),o=A(t,!0),!Qt||Zt&&r===Ut&&a===qt||(Zt&&te(),Zt=setInterval(function(){var t=A(document.elementFromPoint(r,a),!0);t!==o&&(o=t,Jt()),ne(e,i.options,t,n)},10),Ut=r,qt=a)):this.options.bubbleScroll&&A(t,!0)!==O()?ne(e,this.options,A(t,!1),!1):Jt()}},a(t,{pluginName:"scroll",initializeByDefault:!0})}),Ft.mount(ie,oe),Ft.mount(new function(){function t(){this.defaults={swapClass:"sortable-swap-highlight"}}return t.prototype={dragStart:function(t){t=t.dragEl;ee=t},dragOverValid:function(t){var e=t.completed,n=t.target,o=t.onMove,i=t.activeSortable,r=t.changed,a=t.cancel;i.options.swap&&(t=this.sortable.el,i=this.options,n&&n!==t&&(t=ee,ee=!1!==o(n)?(k(n,i.swapClass,!0),n):null,t&&t!==ee&&k(t,i.swapClass,!1)),r(),e(!0),a())},drop:function(t){var e,n,o=t.activeSortable,i=t.putSortable,r=t.dragEl,a=i||this.sortable,l=this.options;ee&&k(ee,l.swapClass,!1),ee&&(l.swap||i&&i.options.swap)&&r!==ee&&(a.captureAnimationState(),a!==o&&o.captureAnimationState(),n=ee,t=(e=r).parentNode,l=n.parentNode,t&&l&&!t.isEqualNode(n)&&!l.isEqualNode(e)&&(i=H(e),r=H(n),t.isEqualNode(l)&&i<r&&r++,t.insertBefore(n,t.children[i]),l.insertBefore(e,l.children[r])),a.animateAll(),a!==o&&o.animateAll())},nulling:function(){ee=null}},a(t,{pluginName:"swap",eventProperties:function(){return{swapItem:ee}}})}),Ft.mount(new function(){function t(o){for(var t in this)"_"===t.charAt(0)&&"function"==typeof this[t]&&(this[t]=this[t].bind(this));o.options.avoidImplicitDeselect||(o.options.supportPointer?h(document,"pointerup",this._deselectMultiDrag):(h(document,"mouseup",this._deselectMultiDrag),h(document,"touchend",this._deselectMultiDrag))),h(document,"keydown",this._checkKeyDown),h(document,"keyup",this._checkKeyUp),this.defaults={selectedClass:"sortable-selected",multiDragKey:null,avoidImplicitDeselect:!1,setData:function(t,e){var n="";ue.length&&ae===o?ue.forEach(function(t,e){n+=(e?", ":"")+t.textContent}):n=e.textContent,t.setData("Text",n)}}}return t.prototype={multiDragKeyDown:!1,isMultiDrag:!1,delayStartGlobal:function(t){t=t.dragEl;le=t},delayEnded:function(){this.isMultiDrag=~ue.indexOf(le)},setupClone:function(t){var e=t.sortable,t=t.cancel;if(this.isMultiDrag){for(var n=0;n<ue.length;n++)de.push(_(ue[n])),de[n].sortableIndex=ue[n].sortableIndex,de[n].draggable=!1,de[n].style["will-change"]="",k(de[n],this.options.selectedClass,!1),ue[n]===le&&k(de[n],this.options.chosenClass,!1);e._hideClone(),t()}},clone:function(t){var e=t.sortable,n=t.rootEl,o=t.dispatchSortableEvent,t=t.cancel;this.isMultiDrag&&(this.options.removeCloneOnHide||ue.length&&ae===e&&(ge(!0,n),o("clone"),t()))},showClone:function(t){var e=t.cloneNowShown,n=t.rootEl,t=t.cancel;this.isMultiDrag&&(ge(!1,n),de.forEach(function(t){R(t,"display","")}),e(),ce=!1,t())},hideClone:function(t){var e=this,n=(t.sortable,t.cloneNowHidden),t=t.cancel;this.isMultiDrag&&(de.forEach(function(t){R(t,"display","none"),e.options.removeCloneOnHide&&t.parentNode&&t.parentNode.removeChild(t)}),n(),ce=!0,t())},dragStartGlobal:function(t){t.sortable;!this.isMultiDrag&&ae&&ae.multiDrag._deselectMultiDrag(),ue.forEach(function(t){t.sortableIndex=H(t)}),ue=ue.sort(function(t,e){return t.sortableIndex-e.sortableIndex}),fe=!0},dragStarted:function(t){var e,n=this,t=t.sortable;this.isMultiDrag&&(this.options.sort&&(t.captureAnimationState(),this.options.animation&&(ue.forEach(function(t){t!==le&&R(t,"position","absolute")}),e=X(le,!1,!0,!0),ue.forEach(function(t){t!==le&&C(t,e)}),he=pe=!0)),t.animateAll(function(){he=pe=!1,n.options.animation&&ue.forEach(function(t){T(t)}),n.options.sort&&me()}))},dragOver:function(t){var e=t.target,n=t.completed,t=t.cancel;pe&&~ue.indexOf(e)&&(n(!1),t())},revert:function(t){var n,o,e=t.fromSortable,i=t.rootEl,r=t.sortable,a=t.dragRect;1<ue.length&&(ue.forEach(function(t){r.addAnimationState({target:t,rect:pe?X(t):a}),T(t),t.fromRect=a,e.removeAnimationState(t)}),pe=!1,n=!this.options.removeCloneOnHide,o=i,ue.forEach(function(t,e){e=o.children[t.sortableIndex+(n?Number(e):0)];e?o.insertBefore(t,e):o.appendChild(t)}))},dragOverCompleted:function(t){var e,n=t.sortable,o=t.isOwner,i=t.insertion,r=t.activeSortable,a=t.parentEl,l=t.putSortable,t=this.options;i&&(o&&r._hideClone(),he=!1,t.animation&&1<ue.length&&(pe||!o&&!r.options.sort&&!l)&&(e=X(le,!1,!0,!0),ue.forEach(function(t){t!==le&&(C(t,e),a.appendChild(t))}),pe=!0),o||(pe||me(),1<ue.length?(o=ce,r._showClone(n),r.options.animation&&!ce&&o&&de.forEach(function(t){r.addAnimationState({target:t,rect:se}),t.fromRect=se,t.thisAnimationDuration=null})):r._showClone(n)))},dragOverAnimationCapture:function(t){var e=t.dragRect,n=t.isOwner,t=t.activeSortable;ue.forEach(function(t){t.thisAnimationDuration=null}),t.options.animation&&!n&&t.multiDrag.isMultiDrag&&(se=a({},e),e=v(le,!0),se.top-=e.f,se.left-=e.e)},dragOverAnimationComplete:function(){pe&&(pe=!1,me())},drop:function(t){var e=t.originalEvent,n=t.rootEl,o=t.parentEl,i=t.sortable,r=t.dispatchSortableEvent,a=t.oldIndex,l=t.putSortable,s=l||this.sortable;if(e){var c,u,d,h=this.options,p=o.children;if(!fe)if(h.multiDragKey&&!this.multiDragKeyDown&&this._deselectMultiDrag(),k(le,h.selectedClass,!~ue.indexOf(le)),~ue.indexOf(le))ue.splice(ue.indexOf(le),1),re=null,z({sortable:i,rootEl:n,name:"deselect",targetEl:le,originalEvent:e});else{if(ue.push(le),z({sortable:i,rootEl:n,name:"select",targetEl:le,originalEvent:e}),e.shiftKey&&re&&i.el.contains(re)){var f=H(re),t=H(le);if(~f&&~t&&f!==t)for(var g,m=f<t?(g=f,t):(g=t,f+1);g<m;g++)~ue.indexOf(p[g])||(k(p[g],h.selectedClass,!0),ue.push(p[g]),z({sortable:i,rootEl:n,name:"select",targetEl:p[g],originalEvent:e}))}else re=le;ae=s}fe&&this.isMultiDrag&&(pe=!1,(o[W].options.sort||o!==n)&&1<ue.length&&(c=X(le),u=H(le,":not(."+this.options.selectedClass+")"),!he&&h.animation&&(le.thisAnimationDuration=null),s.captureAnimationState(),he||(h.animation&&(le.fromRect=c,ue.forEach(function(t){var e;t.thisAnimationDuration=null,t!==le&&(e=pe?X(t):c,t.fromRect=e,s.addAnimationState({target:t,rect:e}))})),me(),ue.forEach(function(t){p[u]?o.insertBefore(t,p[u]):o.appendChild(t),u++}),a===H(le)&&(d=!1,ue.forEach(function(t){t.sortableIndex!==H(t)&&(d=!0)}),d&&(r("update"),r("sort")))),ue.forEach(function(t){T(t)}),s.animateAll()),ae=s),(n===o||l&&"clone"!==l.lastPutMode)&&de.forEach(function(t){t.parentNode&&t.parentNode.removeChild(t)})}},nullingGlobal:function(){this.isMultiDrag=fe=!1,de.length=0},destroyGlobal:function(){this._deselectMultiDrag(),p(document,"pointerup",this._deselectMultiDrag),p(document,"mouseup",this._deselectMultiDrag),p(document,"touchend",this._deselectMultiDrag),p(document,"keydown",this._checkKeyDown),p(document,"keyup",this._checkKeyUp)},_deselectMultiDrag:function(t){if(!(void 0!==fe&&fe||ae!==this.sortable||t&&P(t.target,this.options.draggable,this.sortable.el,!1)||t&&0!==t.button))for(;ue.length;){var e=ue[0];k(e,this.options.selectedClass,!1),ue.shift(),z({sortable:this.sortable,rootEl:this.sortable.el,name:"deselect",targetEl:e,originalEvent:t})}},_checkKeyDown:function(t){t.key===this.options.multiDragKey&&(this.multiDragKeyDown=!0)},_checkKeyUp:function(t){t.key===this.options.multiDragKey&&(this.multiDragKeyDown=!1)}},a(t,{pluginName:"multiDrag",utils:{select:function(t){var e=t.parentNode[W];e&&e.options.multiDrag&&!~ue.indexOf(t)&&(ae&&ae!==e&&(ae.multiDrag._deselectMultiDrag(),ae=e),k(t,e.options.selectedClass,!0),ue.push(t))},deselect:function(t){var e=t.parentNode[W],n=ue.indexOf(t);e&&e.options.multiDrag&&~n&&(k(t,e.options.selectedClass,!1),ue.splice(n,1))}},eventProperties:function(){var n=this,o=[],i=[];return ue.forEach(function(t){var e;o.push({multiDragElement:t,index:t.sortableIndex}),e=pe&&t!==le?-1:pe?H(t,":not(."+n.options.selectedClass+")"):H(t),i.push({multiDragElement:t,index:e})}),{items:r(ue),clones:[].concat(de),oldIndicies:o,newIndicies:i}},optionListeners:{multiDragKey:function(t){return"ctrl"===(t=t.toLowerCase())?t="Control":1<t.length&&(t=t.charAt(0).toUpperCase()+t.substr(1)),t}}})}),Ft});
},{}],7:[function(require,module,exports){
(function (global){(function (){
/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global global, define, Symbol, Reflect, Promise, SuppressedError */
var __extends;
var __assign;
var __rest;
var __decorate;
var __param;
var __esDecorate;
var __runInitializers;
var __propKey;
var __setFunctionName;
var __metadata;
var __awaiter;
var __generator;
var __exportStar;
var __values;
var __read;
var __spread;
var __spreadArrays;
var __spreadArray;
var __await;
var __asyncGenerator;
var __asyncDelegator;
var __asyncValues;
var __makeTemplateObject;
var __importStar;
var __importDefault;
var __classPrivateFieldGet;
var __classPrivateFieldSet;
var __classPrivateFieldIn;
var __createBinding;
var __addDisposableResource;
var __disposeResources;
(function (factory) {
    var root = typeof global === "object" ? global : typeof self === "object" ? self : typeof this === "object" ? this : {};
    if (typeof define === "function" && define.amd) {
        define("tslib", ["exports"], function (exports) { factory(createExporter(root, createExporter(exports))); });
    }
    else if (typeof module === "object" && typeof module.exports === "object") {
        factory(createExporter(root, createExporter(module.exports)));
    }
    else {
        factory(createExporter(root));
    }
    function createExporter(exports, previous) {
        if (exports !== root) {
            if (typeof Object.create === "function") {
                Object.defineProperty(exports, "__esModule", { value: true });
            }
            else {
                exports.__esModule = true;
            }
        }
        return function (id, v) { return exports[id] = previous ? previous(id, v) : v; };
    }
})
(function (exporter) {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };

    __extends = function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };

    __assign = Object.assign || function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };

    __rest = function (s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    };

    __decorate = function (decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };

    __param = function (paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); }
    };

    __esDecorate = function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
        function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
        var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
        var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
        var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
        var _, done = false;
        for (var i = decorators.length - 1; i >= 0; i--) {
            var context = {};
            for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
            for (var p in contextIn.access) context.access[p] = contextIn.access[p];
            context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
            var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
            if (kind === "accessor") {
                if (result === void 0) continue;
                if (result === null || typeof result !== "object") throw new TypeError("Object expected");
                if (_ = accept(result.get)) descriptor.get = _;
                if (_ = accept(result.set)) descriptor.set = _;
                if (_ = accept(result.init)) initializers.unshift(_);
            }
            else if (_ = accept(result)) {
                if (kind === "field") initializers.unshift(_);
                else descriptor[key] = _;
            }
        }
        if (target) Object.defineProperty(target, contextIn.name, descriptor);
        done = true;
    };

    __runInitializers = function (thisArg, initializers, value) {
        var useValue = arguments.length > 2;
        for (var i = 0; i < initializers.length; i++) {
            value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
        }
        return useValue ? value : void 0;
    };

    __propKey = function (x) {
        return typeof x === "symbol" ? x : "".concat(x);
    };

    __setFunctionName = function (f, name, prefix) {
        if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
        return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
    };

    __metadata = function (metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
    };

    __awaiter = function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };

    __generator = function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (g && (g = 0, op[0] && (_ = 0)), _) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };

    __exportStar = function(m, o) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
    };

    __createBinding = Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
            desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    });

    __values = function (o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };

    __read = function (o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    };

    /** @deprecated */
    __spread = function () {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    };

    /** @deprecated */
    __spreadArrays = function () {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    };

    __spreadArray = function (to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    };

    __await = function (v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    };

    __asyncGenerator = function (thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);  }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    };

    __asyncDelegator = function (o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
    };

    __asyncValues = function (o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
    };

    __makeTemplateObject = function (cooked, raw) {
        if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
        return cooked;
    };

    var __setModuleDefault = Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
        o["default"] = v;
    };

    __importStar = function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    };

    __importDefault = function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };

    __classPrivateFieldGet = function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };

    __classPrivateFieldSet = function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };

    __classPrivateFieldIn = function (state, receiver) {
        if (receiver === null || (typeof receiver !== "object" && typeof receiver !== "function")) throw new TypeError("Cannot use 'in' operator on non-object");
        return typeof state === "function" ? receiver === state : state.has(receiver);
    };

    __addDisposableResource = function (env, value, async) {
        if (value !== null && value !== void 0) {
            if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
            var dispose;
            if (async) {
                if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
                dispose = value[Symbol.asyncDispose];
            }
            if (dispose === void 0) {
                if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
                dispose = value[Symbol.dispose];
            }
            if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
            env.stack.push({ value: value, dispose: dispose, async: async });
        }
        else if (async) {
            env.stack.push({ async: true });
        }
        return value;
    };

    var _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    __disposeResources = function (env) {
        function fail(e) {
            env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        function next() {
            while (env.stack.length) {
                var rec = env.stack.pop();
                try {
                    var result = rec.dispose && rec.dispose.call(rec.value);
                    if (rec.async) return Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                }
                catch (e) {
                    fail(e);
                }
            }
            if (env.hasError) throw env.error;
        }
        return next();
    };

    exporter("__extends", __extends);
    exporter("__assign", __assign);
    exporter("__rest", __rest);
    exporter("__decorate", __decorate);
    exporter("__param", __param);
    exporter("__esDecorate", __esDecorate);
    exporter("__runInitializers", __runInitializers);
    exporter("__propKey", __propKey);
    exporter("__setFunctionName", __setFunctionName);
    exporter("__metadata", __metadata);
    exporter("__awaiter", __awaiter);
    exporter("__generator", __generator);
    exporter("__exportStar", __exportStar);
    exporter("__createBinding", __createBinding);
    exporter("__values", __values);
    exporter("__read", __read);
    exporter("__spread", __spread);
    exporter("__spreadArrays", __spreadArrays);
    exporter("__spreadArray", __spreadArray);
    exporter("__await", __await);
    exporter("__asyncGenerator", __asyncGenerator);
    exporter("__asyncDelegator", __asyncDelegator);
    exporter("__asyncValues", __asyncValues);
    exporter("__makeTemplateObject", __makeTemplateObject);
    exporter("__importStar", __importStar);
    exporter("__importDefault", __importDefault);
    exporter("__classPrivateFieldGet", __classPrivateFieldGet);
    exporter("__classPrivateFieldSet", __classPrivateFieldSet);
    exporter("__classPrivateFieldIn", __classPrivateFieldIn);
    exporter("__addDisposableResource", __addDisposableResource);
    exporter("__disposeResources", __disposeResources);
});

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],8:[function(require,module,exports){
"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _ATCPlugin_instances, _ATCPlugin_airbaseDropdown, _ATCPlugin_airbases, _ATCPlugin_app, _ATCPlugin_contextName, _ATCPlugin_element, _ATCPlugin_ejs, _ATCPlugin_imagePath, _ATCPlugin_leaflet, _ATCPlugin_panel, _ATCPlugin_runwayDisplay, _ATCPlugin_selectedAirbase, _ATCPlugin_stripboard, _ATCPlugin_strips, _ATCPlugin_templates, _ATCPlugin_unitContextMenu, _ATCPlugin_updatesInterval, _ATCPlugin_utilities, _ATCPlugin_createStrip, _ATCPlugin_injectSVGs, _ATCPlugin_populateAirbases;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATCPlugin = void 0;
const svg_injector_1 = require("@tanem/svg-injector");
const sortablejs_1 = __importDefault(require("sortablejs"));
const strip_1 = require("./strip");
class ATCPlugin {
    constructor() {
        _ATCPlugin_instances.add(this);
        _ATCPlugin_airbaseDropdown.set(this, void 0);
        _ATCPlugin_airbases.set(this, void 0);
        _ATCPlugin_app.set(this, void 0);
        _ATCPlugin_contextName.set(this, "atc");
        _ATCPlugin_element.set(this, void 0);
        _ATCPlugin_ejs.set(this, void 0);
        _ATCPlugin_imagePath.set(this, "/plugins/atcplugin/images/");
        _ATCPlugin_leaflet.set(this, void 0);
        _ATCPlugin_panel.set(this, void 0);
        _ATCPlugin_runwayDisplay.set(this, void 0);
        _ATCPlugin_selectedAirbase.set(this, null);
        _ATCPlugin_stripboard.set(this, void 0);
        _ATCPlugin_strips.set(this, {});
        _ATCPlugin_templates.set(this, {
            "panel": `
            <div id="atc-panel-header">
                <h2>ATC</h2>
                <div>
                    <button data-on-click="atcCentreOnAirbase"><img src="${__classPrivateFieldGet(this, _ATCPlugin_imagePath, "f")}arrows-to-dot-solid.svg" /></button>
                    <div id="atc-airbase-select" class="ol-select narrow">
                        <div class="ol-select-value">Select an airbase</div>
                        <div class="ol-select-options"></div>
                    </div>
                </div>
            </div>
            <ul id="atc-runway-data">
            </ul>
            <div id="atc-panel-content">                
                <ul id="atc-stripboard" class="ol-scrollable"></ul>
            </div>
        `,
            "runways": `
            <% runways.forEach( runway => { %>
                <li>
                    <div class="atc-runway">
                        <% runway.headings.forEach( heading => { %>
                            <% for( const[ name, data ] of Object.entries(heading)) { %>
                                <div class="heading"><% if (data.ILS) { %><abbr title="<%= data.ILS %>">ILS</abbr><% } %><abbr title="Mag heading: <%= data.magHeading %>"><%= name.replace("(CLOSED)", "(C)") %></abbr></div>
                            <% } %>
                        <% }) %>
                    </div>
                </li>
            <% }) %>
        `,
            "strip": `
            <div class="atc-strip-top-bar">
                <div class="atc-strip-handle"><img src="${__classPrivateFieldGet(this, _ATCPlugin_imagePath, "f")}sort-solid.svg" /><span class="atc-aircraft-name"><%= unit.getUnitName() %></span></div>
                <div class="atc-strip-buttons">
                    <button data-on-click="atcDeclareEmergency" data-on-click-params='{"unitID":"<%= unit.ID %>"}'><img src="${__classPrivateFieldGet(this, _ATCPlugin_imagePath, "f")}triangle-exclamation-solid.svg" /></button>
                    <button data-on-click="atcDeleteStrip" data-on-click-params='{"unitID":"<%= unit.ID %>"}'><img src="${__classPrivateFieldGet(this, _ATCPlugin_imagePath, "f")}delete-left-solid.svg" /></button>
                </div>
            </div>

            <div class="atc-strip-info">
                <div class="bearing-range info-cell">
                    <abbr title="Bearing, Range">BR</abbr>
                    <div data-purpose="bearing-range">?</div>
                </div>
                <div class="assigned-actual altitude">
                    <div class="assigned info-cell">
                        <abbr title="ASSIGNED altitude (allows ± 200ft)">Asn. Alt</abbr>
                        <input type="number" min="0" max="50000" step="500" data-purpose="assigned altitude" placeholder="-----" />
                    </div>
                    <div class="actual info-cell">
                        <abbr title="Altitude ACTUAL">Alt</abbr>
                        <div data-purpose="actual altitude">?</div>
                    </div>
                </div>

                <div class="assigned-actual speed">
                    <div class="assigned info-cell">
                        <abbr title="ASSIGNED speed (allows ± 2%)">Asn. Spd</abbr>
                        <input type="number" min="0" max="600" step="25" data-purpose="assigned speed" placeholder="---" />
                    </div>
                    <div class="actual info-cell">
                        <abbr title="Speed ACTUAL">Spd</abbr>
                        <div data-purpose="actual speed">?</div>
                    </div>
                </div>

                <div class="atc-strip-runway">
                    <div class="ol-select narrow" data-purpose="runway">
                        <div class="ol-select-value">RWY</div>
                        <div class="ol-select-options"></div>
                    </div>
                </div>
            </div>
        `
        });
        _ATCPlugin_unitContextMenu.set(this, void 0);
        _ATCPlugin_updatesInterval.set(this, void 0);
        _ATCPlugin_utilities.set(this, void 0);
    }
    initialize(app) {
        var _a, _b;
        __classPrivateFieldSet(this, _ATCPlugin_app, app, "f");
        __classPrivateFieldSet(this, _ATCPlugin_ejs, __classPrivateFieldGet(this, _ATCPlugin_app, "f").getTemplateManger().getTemplateEngine(), "f");
        __classPrivateFieldSet(this, _ATCPlugin_leaflet, __classPrivateFieldGet(this, _ATCPlugin_app, "f").getMap().getLeaflet(), "f");
        __classPrivateFieldSet(this, _ATCPlugin_utilities, __classPrivateFieldGet(this, _ATCPlugin_app, "f").getUtilities(), "f");
        const unitContextMenu = document.createElement("div");
        unitContextMenu.id = "atc-unit-context-menu";
        unitContextMenu.className = "ol-context-menu no-airbase";
        unitContextMenu.innerHTML = `
            <div class="ol-panel">
                <p class="no-airbase">No airbase selected</p>
                <button id="atc-add-to-approach" data-on-click="atcAddToApproach">Add to approach</button>
            </div>
        `;
        document.body.appendChild(unitContextMenu);
        const contextManager = __classPrivateFieldGet(this, _ATCPlugin_app, "f").getContextManager();
        contextManager.add(__classPrivateFieldGet(this, _ATCPlugin_contextName, "f"), {
            "allowUnitCopying": false,
            "allowUnitPasting": false,
            "contextMenus": {
                "map": false,
                "unit": {
                    "id": "atc-unit-context-menu"
                }
            },
            "useMouseInfoPanel": false,
            "useUnitControlPanel": false,
            "useUnitInfoPanel": false
        });
        __classPrivateFieldSet(this, _ATCPlugin_unitContextMenu, contextManager.get(__classPrivateFieldGet(this, _ATCPlugin_contextName, "f")).getContextMenuManager().get("unit"), "f");
        __classPrivateFieldSet(this, _ATCPlugin_element, document.createElement("div"), "f");
        __classPrivateFieldGet(this, _ATCPlugin_element, "f").id = "atc-panel";
        __classPrivateFieldGet(this, _ATCPlugin_element, "f").className = "ol-panel hide";
        __classPrivateFieldGet(this, _ATCPlugin_element, "f").innerHTML = __classPrivateFieldGet(this, _ATCPlugin_templates, "f").panel;
        document.body.appendChild(__classPrivateFieldGet(this, _ATCPlugin_element, "f"));
        __classPrivateFieldGet(this, _ATCPlugin_instances, "m", _ATCPlugin_injectSVGs).call(this, __classPrivateFieldGet(this, _ATCPlugin_element, "f"));
        __classPrivateFieldSet(this, _ATCPlugin_panel, __classPrivateFieldGet(this, _ATCPlugin_app, "f").getMap().createPanel(__classPrivateFieldGet(this, _ATCPlugin_element, "f").id), "f");
        const openFunction = (ev) => {
            if (contextManager.currentContextIs(__classPrivateFieldGet(this, _ATCPlugin_contextName, "f"))) {
                closeFunction(ev);
            }
            else {
                this.startUpdates();
                __classPrivateFieldGet(this, _ATCPlugin_element, "f").classList.remove("hide");
                contextManager.setContext(__classPrivateFieldGet(this, _ATCPlugin_contextName, "f"));
            }
        };
        //  Stripboard
        __classPrivateFieldSet(this, _ATCPlugin_stripboard, document.getElementById("atc-stripboard"), "f");
        new sortablejs_1.default(__classPrivateFieldGet(this, _ATCPlugin_stripboard, "f"), {
            "animation": 250,
            "handle": ".atc-strip-handle",
            "easing": "cubic-bezier(1, 0, 0, 1)",
            "onSort": (ev) => {
                this.getStripboard().querySelectorAll(":scope > li:not(.hide)").forEach((el, i) => {
                    if (!__classPrivateFieldGet(this, _ATCPlugin_selectedAirbase, "f"))
                        return;
                    if (el.hasAttribute("data-unit-id")) {
                        const strip = __classPrivateFieldGet(this, _ATCPlugin_strips, "f")[__classPrivateFieldGet(this, _ATCPlugin_selectedAirbase, "f").getName()][el.getAttribute("data-unit-id") + ""];
                        if (strip)
                            strip.setPosition(i);
                    }
                });
            }
        });
        //  Element for displaying the runways
        __classPrivateFieldSet(this, _ATCPlugin_runwayDisplay, this.getElement().querySelector("#atc-runway-data"), "f");
        //  Close function
        const closeFunction = (ev) => {
            __classPrivateFieldGet(this, _ATCPlugin_element, "f").classList.add("hide");
            contextManager.setContext("olympus");
            this.stopUpdates();
        };
        (_a = document.getElementById("atc-close")) === null || _a === void 0 ? void 0 : _a.addEventListener("click", closeFunction);
        //  Insert to plugin toolbar
        const item = __classPrivateFieldGet(this, _ATCPlugin_app, "f").getPluginsManager().createPluginToolbarItem(this, {
            "innerHTML": `<button title="ATC tools"><img src="${__classPrivateFieldGet(this, _ATCPlugin_imagePath, "f")}tower-observation-solid.svg" /></button>`
        });
        const element = item.insert();
        (_b = element.querySelector("button")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", openFunction);
        //  Listen for "add to approach" event
        document.addEventListener("atcAddToApproach", (ev) => {
            __classPrivateFieldGet(this, _ATCPlugin_app, "f").getUnitsManager().getSelectedUnits().forEach((unit) => {
                if (["Aircraft", "Helicopter"].includes(unit.getCategory()) && unit.getAlive())
                    this.addUnit(unit.ID);
            });
            __classPrivateFieldGet(this, _ATCPlugin_unitContextMenu, "f").hide();
        });
        __classPrivateFieldGet(this, _ATCPlugin_instances, "m", _ATCPlugin_populateAirbases).call(this);
        document.addEventListener("atcCentreOnAirbase", (ev) => {
            const airbase = this.getSelectedAirbase();
            if (airbase)
                __classPrivateFieldGet(this, _ATCPlugin_app, "f").getMap().setView(airbase.getLatLng());
        });
        document.addEventListener("atcDeleteStrip", (ev) => {
            const airbase = this.getSelectedAirbase();
            if (!airbase)
                return false;
            const strip = __classPrivateFieldGet(this, _ATCPlugin_strips, "f")[airbase.getName()][ev.detail.unitID];
            if (strip instanceof strip_1.Strip) {
                strip.delete();
                delete __classPrivateFieldGet(this, _ATCPlugin_strips, "f")[airbase.getName()][ev.detail.unitID];
            }
        });
        document.addEventListener("atcDeclareEmergency", (ev) => {
            const strip = this.getStripByUnitID(ev.detail.unitID);
            if (strip)
                strip.getElement().toggleAttribute("data-declare-emergency");
        });
        return true;
    }
    addUnit(unitID) {
        const airbase = this.getSelectedAirbase();
        if (!airbase)
            return false;
        const airbaseName = airbase.getName();
        if (!__classPrivateFieldGet(this, _ATCPlugin_strips, "f")[airbaseName])
            __classPrivateFieldGet(this, _ATCPlugin_strips, "f")[airbaseName] = {};
        else if (__classPrivateFieldGet(this, _ATCPlugin_strips, "f")[airbaseName][unitID])
            return false;
        __classPrivateFieldGet(this, _ATCPlugin_instances, "m", _ATCPlugin_createStrip).call(this, unitID);
    }
    doUpdate() {
        const airbase = this.getSelectedAirbase();
        if (!airbase)
            return;
        const units = __classPrivateFieldGet(this, _ATCPlugin_app, "f").getUnitsManager().getUnits();
        const strips = this.getAirbaseStrips();
        if (!strips)
            return;
        Object.values(strips).forEach(strip => {
            const unit = units[strip.getUnitID()];
            if (!unit)
                return; //  TODO: make it put an alert on the stripboard
            const stripElement = strip.getElement();
            const actualAlt = Math.round(__classPrivateFieldGet(this, _ATCPlugin_utilities, "f").mToFt(unit.getPosition().alt || 1) / 100) * 100;
            const actualSpeed = Math.round(__classPrivateFieldGet(this, _ATCPlugin_utilities, "f").msToKts(unit.getSpeed()));
            const assignedAlt = strip.getAssignedAltitude();
            const assignedSpeed = strip.getAssignedSpeed();
            const altitudeLeeway = 200; //  Amount
            const speedLeeway = 0.02; //  Percentage
            const bearing = __classPrivateFieldGet(this, _ATCPlugin_utilities, "f").zeroPrepend(Math.round(__classPrivateFieldGet(this, _ATCPlugin_utilities, "f").bearing(airbase.getLatLng(), unit.getLatLng())), 3);
            const range = Math.round(__classPrivateFieldGet(this, _ATCPlugin_utilities, "f").mToNm(__classPrivateFieldGet(this, _ATCPlugin_utilities, "f").distance(airbase.getLatLng(), unit.getLatLng())));
            stripElement.querySelectorAll(`[data-purpose="bearing-range"]`).forEach((el) => {
                if (el instanceof HTMLElement)
                    el.innerText = `${bearing} / ${range}`;
            });
            stripElement.querySelectorAll(`[data-purpose="actual altitude"]`).forEach((el) => {
                if (el instanceof HTMLElement)
                    el.innerText = actualAlt + "";
            });
            stripElement.querySelectorAll(`[data-purpose="actual speed"]`).forEach((el) => {
                if (el instanceof HTMLElement)
                    el.innerText = actualSpeed + "";
            });
            stripElement.toggleAttribute("data-altitude-warning", (assignedAlt > 0 && (actualAlt <= assignedAlt - altitudeLeeway || actualAlt >= assignedAlt + altitudeLeeway)));
            const speedDelta = assignedSpeed * speedLeeway;
            stripElement.toggleAttribute("data-speed-warning", (assignedSpeed > 0 && (actualSpeed <= assignedSpeed - speedDelta || actualSpeed >= assignedSpeed + speedDelta)));
            if (strip.getPolyline())
                strip.removePolyline();
            if (unit.getHighlighted())
                this.drawPolyline(strip, airbase, unit);
        });
    }
    drawPolyline(strip, airbase, unit) {
        if (strip.getPolyline())
            strip.removePolyline();
        const polyline = __classPrivateFieldGet(this, _ATCPlugin_leaflet, "f").polyline([airbase.getLatLng(), unit.getLatLng()], {
            "color": "#ffea00",
            "weight": 3
        });
        polyline.addTo(__classPrivateFieldGet(this, _ATCPlugin_app, "f").getMap());
        strip.setPolyline(polyline);
    }
    getElement() {
        return __classPrivateFieldGet(this, _ATCPlugin_element, "f");
    }
    getAirbaseStrips() {
        return (__classPrivateFieldGet(this, _ATCPlugin_selectedAirbase, "f")) ? __classPrivateFieldGet(this, _ATCPlugin_strips, "f")[__classPrivateFieldGet(this, _ATCPlugin_selectedAirbase, "f").getName()] : false;
    }
    getName() {
        return __classPrivateFieldGet(this, _ATCPlugin_contextName, "f");
    }
    getRunwayDisplay() {
        return __classPrivateFieldGet(this, _ATCPlugin_runwayDisplay, "f");
    }
    getRunwayHeadings(airbase) {
        airbase = airbase || __classPrivateFieldGet(this, _ATCPlugin_selectedAirbase, "f");
        if (!airbase)
            return false;
        const headings = airbase.getChartData().runways.reduce((acc, runway) => {
            acc = acc.concat(Object.keys(runway.headings[0]));
            return acc;
        }, []);
        headings.sort();
        return headings;
    }
    getSelectedAirbase() {
        return __classPrivateFieldGet(this, _ATCPlugin_selectedAirbase, "f");
    }
    getStripByUnitID(unitID) {
        const airbase = this.getSelectedAirbase();
        return (airbase) ? __classPrivateFieldGet(this, _ATCPlugin_strips, "f")[airbase.getName()][unitID] : false;
    }
    getStripboard() {
        return __classPrivateFieldGet(this, _ATCPlugin_stripboard, "f");
    }
    startUpdates() {
        console.log("ATC: starting updates");
        __classPrivateFieldSet(this, _ATCPlugin_updatesInterval, setInterval(() => {
            this.doUpdate();
        }, 2000), "f");
    }
    stopUpdates() {
        console.log("ATC: stopping updates");
        clearInterval(__classPrivateFieldGet(this, _ATCPlugin_updatesInterval, "f"));
    }
}
exports.ATCPlugin = ATCPlugin;
_ATCPlugin_airbaseDropdown = new WeakMap(), _ATCPlugin_airbases = new WeakMap(), _ATCPlugin_app = new WeakMap(), _ATCPlugin_contextName = new WeakMap(), _ATCPlugin_element = new WeakMap(), _ATCPlugin_ejs = new WeakMap(), _ATCPlugin_imagePath = new WeakMap(), _ATCPlugin_leaflet = new WeakMap(), _ATCPlugin_panel = new WeakMap(), _ATCPlugin_runwayDisplay = new WeakMap(), _ATCPlugin_selectedAirbase = new WeakMap(), _ATCPlugin_stripboard = new WeakMap(), _ATCPlugin_strips = new WeakMap(), _ATCPlugin_templates = new WeakMap(), _ATCPlugin_unitContextMenu = new WeakMap(), _ATCPlugin_updatesInterval = new WeakMap(), _ATCPlugin_utilities = new WeakMap(), _ATCPlugin_instances = new WeakSet(), _ATCPlugin_createStrip = function _ATCPlugin_createStrip(unitID) {
    const unit = __classPrivateFieldGet(this, _ATCPlugin_app, "f").getUnitsManager().getUnitByID(unitID);
    if (!unit)
        return false;
    const airbase = this.getSelectedAirbase();
    if (!airbase)
        return false;
    const stripsAtThisAirbase = __classPrivateFieldGet(this, _ATCPlugin_strips, "f")[airbase.getName()];
    const stripElement = document.createElement("li");
    stripElement.className = "atc-strip";
    stripElement.innerHTML += __classPrivateFieldGet(this, _ATCPlugin_ejs, "f").render(__classPrivateFieldGet(this, _ATCPlugin_templates, "f").strip, {
        "unit": unit
    });
    stripElement.setAttribute("data-unit-id", unitID + "");
    const strip = new strip_1.Strip(__classPrivateFieldGet(this, _ATCPlugin_app, "f").getMap(), {
        "airbase": airbase,
        "position": Object.keys(stripsAtThisAirbase).length,
        "stripElement": stripElement,
        "unitID": unitID
    });
    const runway = stripElement.querySelector(`.ol-select[data-purpose="runway"]`);
    if (runway instanceof HTMLElement) {
        let runwayHeadings = this.getRunwayHeadings();
        if (!runwayHeadings) {
            runwayHeadings = ["No data"];
        }
        else {
            runwayHeadings.unshift("---");
        }
        strip.setRunwayDropdown(__classPrivateFieldGet(this, _ATCPlugin_panel, "f").createDropdown({
            "ID": runway,
            "callback": (value) => {
                const airbase = this.getSelectedAirbase();
                if (!airbase)
                    return;
                __classPrivateFieldGet(this, _ATCPlugin_strips, "f")[airbase.getName()][unitID].setRunway(value);
            },
            "defaultText": "---",
            "options": runwayHeadings
        }));
    }
    stripElement.querySelectorAll("input[data-purpose]").forEach(input => {
        input.addEventListener("input", (ev) => {
            if (input instanceof HTMLInputElement === false)
                return;
            const purpose = input.getAttribute("data-purpose");
            const value = (input.value === "") ? -1 : parseInt(input.value);
            if (purpose === "assigned altitude") {
                strip.setAssignedAltitude(value);
            }
            if (purpose === "assigned speed") {
                strip.setAssignedSpeed(value);
            }
        });
    });
    this.getStripboard().appendChild(stripElement);
    __classPrivateFieldGet(this, _ATCPlugin_instances, "m", _ATCPlugin_injectSVGs).call(this, stripElement);
    stripElement.addEventListener("mouseover", (ev) => {
        unit.setHighlighted(true);
        this.drawPolyline(strip, airbase, unit);
    });
    stripElement.addEventListener("mouseout", (ev) => {
        unit.setHighlighted(false);
        strip.removePolyline();
    });
    __classPrivateFieldGet(this, _ATCPlugin_strips, "f")[airbase.getName()][unitID] = strip;
    return strip;
}, _ATCPlugin_injectSVGs = function _ATCPlugin_injectSVGs(container) {
    (0, svg_injector_1.SVGInjector)(container.querySelectorAll(`img[src$=".svg"]`));
}, _ATCPlugin_populateAirbases = function _ATCPlugin_populateAirbases() {
    new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            __classPrivateFieldSet(this, _ATCPlugin_airbases, __classPrivateFieldGet(this, _ATCPlugin_app, "f").getMissionManager().getAirbases(), "f");
            if (Object.values(__classPrivateFieldGet(this, _ATCPlugin_airbases, "f")).length > 0) {
                clearInterval(interval);
                resolve();
            }
        }, 1000);
    }).then(() => {
        const airbaseOptions = Object.keys(__classPrivateFieldGet(this, _ATCPlugin_airbases, "f")).sort().reduce((output, key) => {
            output.push(__classPrivateFieldGet(this, _ATCPlugin_airbases, "f")[key].getName());
            return output;
        }, []);
        __classPrivateFieldSet(this, _ATCPlugin_airbaseDropdown, __classPrivateFieldGet(this, _ATCPlugin_panel, "f").createDropdown({
            "ID": "atc-airbase-select",
            "callback": (value) => {
                var _a;
                //  Hide all    
                this.getStripboard().querySelectorAll(":scope > li").forEach(el => el.classList.add("hide"));
                this.getRunwayDisplay().innerHTML = "";
                const airbaseName = value;
                __classPrivateFieldSet(this, _ATCPlugin_selectedAirbase, (airbaseName === "") ? null : __classPrivateFieldGet(this, _ATCPlugin_airbases, "f")[airbaseName], "f");
                (_a = __classPrivateFieldGet(this, _ATCPlugin_unitContextMenu, "f").getContainer()) === null || _a === void 0 ? void 0 : _a.classList.toggle("no-airbase", !__classPrivateFieldGet(this, _ATCPlugin_selectedAirbase, "f"));
                if (!__classPrivateFieldGet(this, _ATCPlugin_selectedAirbase, "f"))
                    return;
                this.getRunwayDisplay().innerHTML = __classPrivateFieldGet(this, _ATCPlugin_ejs, "f").render(__classPrivateFieldGet(this, _ATCPlugin_templates, "f").runways, __classPrivateFieldGet(this, _ATCPlugin_selectedAirbase, "f").getChartData());
                const activeStripsAtThisAirbase = __classPrivateFieldGet(this, _ATCPlugin_strips, "f")[__classPrivateFieldGet(this, _ATCPlugin_selectedAirbase, "f").getName()];
                if (activeStripsAtThisAirbase) {
                    Object.values(activeStripsAtThisAirbase).sort((stripA, stripB) => {
                        return (stripA.getPosition() > stripB.getPosition()) ? 1 : -1;
                    }).forEach(strip => strip.getElement().classList.remove("hide"));
                }
            },
            "options": airbaseOptions,
            "defaultText": "Select an airbase"
        }), "f");
    });
};

},{"./strip":10,"@tanem/svg-injector":1,"sortablejs":6}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const atcplugin_1 = require("./atcplugin");
globalThis.getOlympusPlugin = () => {
    return new atcplugin_1.ATCPlugin();
};

},{"./atcplugin":8}],10:[function(require,module,exports){
"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Strip_airbase, _Strip_assignedAlt, _Strip_assignedSpeed, _Strip_element, _Strip_map, _Strip_polyline, _Strip_position, _Strip_runway, _Strip_runwayDropdown, _Strip_unitID;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Strip = void 0;
class Strip {
    constructor(map, stripData) {
        _Strip_airbase.set(this, void 0);
        _Strip_assignedAlt.set(this, -1);
        _Strip_assignedSpeed.set(this, -1);
        _Strip_element.set(this, void 0);
        _Strip_map.set(this, void 0);
        _Strip_polyline.set(this, void 0);
        _Strip_position.set(this, void 0);
        _Strip_runway.set(this, void 0);
        _Strip_runwayDropdown.set(this, void 0);
        _Strip_unitID.set(this, void 0);
        __classPrivateFieldSet(this, _Strip_airbase, stripData.airbase, "f");
        __classPrivateFieldSet(this, _Strip_element, stripData.stripElement, "f");
        __classPrivateFieldSet(this, _Strip_map, map, "f");
        __classPrivateFieldSet(this, _Strip_position, stripData.position, "f");
        __classPrivateFieldSet(this, _Strip_runwayDropdown, stripData.runwayDropdown, "f");
        __classPrivateFieldSet(this, _Strip_unitID, stripData.unitID, "f");
    }
    delete() {
        __classPrivateFieldGet(this, _Strip_element, "f").remove();
        __classPrivateFieldGet(this, _Strip_polyline, "f").remove();
    }
    getAssignedAltitude() {
        return __classPrivateFieldGet(this, _Strip_assignedAlt, "f");
    }
    getAssignedSpeed() {
        return __classPrivateFieldGet(this, _Strip_assignedSpeed, "f");
    }
    getElement() {
        return __classPrivateFieldGet(this, _Strip_element, "f");
    }
    getMap() {
        return __classPrivateFieldGet(this, _Strip_map, "f");
    }
    getPolyline() {
        return __classPrivateFieldGet(this, _Strip_polyline, "f");
    }
    getPosition() {
        return __classPrivateFieldGet(this, _Strip_position, "f");
    }
    getUnitID() {
        return __classPrivateFieldGet(this, _Strip_unitID, "f");
    }
    removePolyline() {
        this.getPolyline().remove();
    }
    setAssignedAltitude(altitude) {
        __classPrivateFieldSet(this, _Strip_assignedAlt, altitude, "f");
    }
    setAssignedSpeed(speed) {
        __classPrivateFieldSet(this, _Strip_assignedSpeed, speed, "f");
    }
    setPolyline(polyline) {
        __classPrivateFieldSet(this, _Strip_polyline, polyline, "f");
    }
    setPosition(position) {
        __classPrivateFieldSet(this, _Strip_position, position, "f");
    }
    setRunway(runway) {
        __classPrivateFieldSet(this, _Strip_runway, runway, "f");
    }
    setRunwayDropdown(runwayDropdown) {
        __classPrivateFieldSet(this, _Strip_runwayDropdown, runwayDropdown, "f");
    }
}
exports.Strip = Strip;
_Strip_airbase = new WeakMap(), _Strip_assignedAlt = new WeakMap(), _Strip_assignedSpeed = new WeakMap(), _Strip_element = new WeakMap(), _Strip_map = new WeakMap(), _Strip_polyline = new WeakMap(), _Strip_position = new WeakMap(), _Strip_runway = new WeakMap(), _Strip_runwayDropdown = new WeakMap(), _Strip_unitID = new WeakMap();

},{}]},{},[9]);
