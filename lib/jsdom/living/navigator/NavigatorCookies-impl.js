"use strict";

exports.implementation = class NavigatorCookiesImpl {
  get cookieEnabled() {
    return false;
  }
};
