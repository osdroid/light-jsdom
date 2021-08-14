"use strict";
const whatwgEncoding = require("whatwg-encoding");
const MIMEType = require("whatwg-mimetype");
const { serializeURL } = require("whatwg-url");

const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const reportException = require("../helpers/runtime-script-errors");
const { domSymbolTree, cloningSteps } = require("../helpers/internal-constants");
const { asciiLowercase } = require("../helpers/strings");
const { childTextContent } = require("../helpers/text");
const { fireAnEvent } = require("../helpers/events");
const { parseURLToResultingURLRecord } = require("../helpers/document-base-url");
const nodeTypes = require("../node-type");

const jsMIMETypes = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/x-ecmascript",
  "application/x-javascript",
  "text/ecmascript",
  "text/javascript",
  "text/javascript1.0",
  "text/javascript1.1",
  "text/javascript1.2",
  "text/javascript1.3",
  "text/javascript1.4",
  "text/javascript1.5",
  "text/jscript",
  "text/livescript",
  "text/x-ecmascript",
  "text/x-javascript"
]);

class HTMLScriptElementImpl extends HTMLElementImpl {
  constructor(globalObject, args, privateData) {
    super(globalObject, args, privateData);
    this._alreadyStarted = false;
    this._parserInserted = false; // set by the parser
  }

  _attach() {
    super._attach();


    // In our current terribly-hacky document.write() implementation, we parse in a div them move elements into the main
    // document. Thus _eval() will bail early when it gets in _poppedOffStackOfOpenElements(), since we're not attached
    // then. Instead, we'll let it eval here.
    if (!this._parserInserted || this._isMovingDueToDocumentWrite) {
      this._eval();
    }
  }

  _canRunScript() {
    const document = this._ownerDocument;
    // Equivalent to the spec's "scripting is disabled" check.
    if (!document._defaultView || document._defaultView._runScripts !== "dangerously" || document._scriptingDisabled) {
      return false;
    }

    return true;
  }

  _fetchExternalScript() {
  }

  _fetchInternalScript() {
  }

  _attrModified(name, value, oldValue) {
    super._attrModified(name, value, oldValue);

    if (this._attached && !this._startedEval && name === "src" && oldValue === null && value !== null) {
      this._fetchExternalScript();
    }
  }

  _poppedOffStackOfOpenElements() {
    // This seems to roughly correspond to
    // https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-incdata:prepare-a-script, although we certainly
    // don't implement the full semantics.
    this._eval();
  }

  // Vaguely similar to https://html.spec.whatwg.org/multipage/scripting.html#prepare-a-script, but we have a long way
  // to go before it's aligned.
  _eval() {
    if (this._alreadyStarted) {
      return;
    }

    // TODO: this text check doesn't seem completely the same as the spec, which e.g. will try to execute scripts with
    // child element nodes. Spec bug? https://github.com/whatwg/html/issues/3419
    if (!this.hasAttributeNS(null, "src") && this.text.length === 0) {
      return;
    }

    if (!this._attached) {
      return;
    }

    const scriptBlocksTypeString = this._getTypeString();
    const type = getType(scriptBlocksTypeString);

    if (type !== "classic") {
      // TODO: implement modules, and then change the check to `type === null`.
      return;
    }

    this._alreadyStarted = true;

    // TODO: implement nomodule here, **but only after we support modules**.

    // At this point we completely depart from the spec.

    if (this.hasAttributeNS(null, "src")) {
      this._fetchExternalScript();
    } else {
      this._fetchInternalScript();
    }
  }

  _getTypeString() {
    const typeAttr = this.getAttributeNS(null, "type");
    const langAttr = this.getAttributeNS(null, "language");

    if (typeAttr === "") {
      return "text/javascript";
    }

    if (typeAttr === null && langAttr === "") {
      return "text/javascript";
    }

    if (typeAttr === null && langAttr === null) {
      return "text/javascript";
    }

    if (typeAttr !== null) {
      return typeAttr.trim();
    }

    if (langAttr !== null) {
      return "text/" + langAttr;
    }

    return null;
  }

  get text() {
    return childTextContent(this);
  }

  set text(text) {
    this.textContent = text;
  }

  // https://html.spec.whatwg.org/multipage/scripting.html#script-processing-model
  [cloningSteps](copy, node) {
    copy._alreadyStarted = node._alreadyStarted;
  }
}

function getType(typeString) {
  const lowercased = asciiLowercase(typeString);
  // Cannot use whatwg-mimetype parsing because that strips whitespace. The spec demands a strict string comparison.
  // That is, the type="" attribute is not really related to MIME types at all.
  if (jsMIMETypes.has(lowercased)) {
    return "classic";
  }
  if (lowercased === "module") {
    return "module";
  }
  return null;
}

module.exports = {
  implementation: HTMLScriptElementImpl
};
