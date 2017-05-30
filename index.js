/*!
 * Stackables module.
 *
 * Copyright (c) 2014-2017 Digital Bazaar, Inc. All rights reserved.
 *
 * @author Dave Longley
 */
(function() {

'use strict';

function init(angular, dialogPolyfill) {

/** ANGULAR REGISTRATION **/

var module = angular.module('stackables', []);

module.directive({stackable: stackableDirective});
module.directive({stackableCancel: stackableCancelDirective});
module.directive({stackableModal: stackableModalDirective});
module.directive({stackablePopover: stackablePopoverDirective});
module.directive({stackablePopoverContent: stackablePopoverContentDirective});
module.directive({stackableTrigger: ['$parse', stackableTriggerDirective]});

/** ANGULAR CONFIGURATION **/

if(angular.version.major >= 1 && angular.version.minor >= 6) {
  /* Note: Angular 1.6+ patched a bug that caused angular's `$location` to
  miss state changes pushed via `window.history.pushState`.

  https://github.com/angular/angular.js/commit/2b360bf30528e636da429396f2fe740c3f97c6f8

  This library was using that "bug" to ensure that the back button could be
  used to close stackables without affecting the location or route in Angular.
  This decorator reverses the change by preventing listeners that are passed to
  `$browser.onUrlChange` from receiving state changes to history when they
  are related to opening or closing stackables. */
  module.config(['$provide', function($provide) {
    $provide.decorator('$browser', ['$delegate', function($delegate) {
      var onUrlChange = $delegate.onUrlChange;
      $delegate.onUrlChange = function(callback) {
        onUrlChange(function(newUrl, newState) {
          // if the URL isn't changing then this is a state change, and
          // we don't report state changes when we open stackables (stack
          // length > 0) or when we close them (reverting back to previous
          // state before stackables were open)
          if((_stack.length > 0 || _prevHistoryState === newState) &&
            newUrl === _stackUrl) {
            // Note: this will also prevent users from clicking on links to
            // the same route that a stackable was opened on when those links
            // are inside a modal, don't ever use those links w/this
            // implementation
            return;
          }
          return callback(newUrl, newState);
        });
      };
      return $delegate;
    }]);
  }]);
}

/** DIALOG POLYFILL **/

var usePolyfill = angular.element('<dialog></dialog>');
usePolyfill = (!usePolyfill[0].showModal &&
  typeof dialogPolyfill !== 'undefined');

if(window.Element && !Element.prototype.closest) {
  Element.prototype.closest = function(s) {
    var matches = (this.document || this.ownerDocument).querySelectorAll(s),
      i,
      el = this;
    do {
      i = matches.length;
      while (--i >= 0 && matches.item(i) !== el) {}
    } while ((i < 0) && (el = el.parentElement));
    return el;
  };
}

/** HISTORY MANAGEMENT **/

if(_hasHistoryAPI()) {
  // add `popstate` handler early, before angular `$browser` adds its own
  // in order to prevent angular from reading an additional history state
  // as we may push the stackables history state back on in the handler
  window.addEventListener('popstate', function() {
    if(_stack.length === 0) {
      return;
    }
    handleBackButton();
  });
}

(function() {
  // restore page history if necessary; this handles the case where the
  // user opens a modal, navigates to another site, and then presses the
  // `back` button... this will ensure to restore the original state as
  // if the modal was never opened on the page
  var count = angular.element(document.body).data('stackables') || 0;
  if(count === 0 && _hasHistoryAPI() && window.history.state &&
    window.history.state.stackables) {
    window.history.back();
  }
})();

// stackables stack, URL that first stackable was opened on, and previous
// history state
var _stack = [];
var _stackUrl;
var _prevHistoryState;

function enableBackButton() {
  _prevHistoryState = window.history.state;
  window.history.pushState({stackables: true}, '');
}

function handleBackButton() {
  // since the back button was pressed, the stackable history state was removed
  // from the history stack; but there may still be stackables open, so add it
  // back here to preserve ability to press back button to close them; it will
  // be auto-removed when the last stackable is closed and the stackable count
  // is decremented to zero
  enableBackButton();
  // force close top modal
  _stack[_stack.length - 1]._forceClose();
}

function _hasHistoryAPI() {
  return 'history' in window;
}

/** DIRECTIVES **/

function stackableDirective() {
  return {
    restrict: 'A',
    controller: ['$browser', Controller]
  };

  function Controller($browser) {
    var self = this;
    var show;

    // link the dialog element
    self.link = function(scope, element) {
      scope.stackable = self;

      // setup `show` mutator to allow `scope.show` to be a setter/getter
      // function instead of a boolean variable
      if(typeof scope.show !== 'function') {
        show = function(value) {
          if(value === undefined) {
            return scope.show;
          }
          scope.show = !!value;
        };
      } else {
        show = scope.show;
      }

      self.isOpen = false;
      var body = angular.element(document.body);
      var dialog = element[0];
      var parent;
      var parentDialog;

      // get z-index of parent dialog, if any
      parent = element.parent()[0];
      if(parent) {
        parentDialog = angular.element(parent.closest('dialog'));
      }
      if(!parentDialog || parentDialog.length === 0) {
        // no dialog parent; move dialog to body to simplify z-indexing
        parent = body;
      } else {
        // ensure element is above parent dialog
        var zIndex = parentDialog.css('z-index');
        var zIndexInt = parseInt(zIndex, 10);
        if(zIndexInt.toString() !== zIndex) {
          zIndex = 0;
        }
        element.css({'z-index': ++zIndexInt});

        // ensure child dialog is a direct descendant of parent for
        // native modal <dialog> which will only show the dialog and
        // its descendants
        if(!usePolyfill) {
          parent = parentDialog;
        } else {
          parent = body;
        }
      }
      if(dialog.parentNode) {
        dialog.parentNode.removeChild(dialog);
      }

      // use polyfill if necessary
      if(usePolyfill) {
        dialogPolyfill.registerDialog(dialog);
      }

      var cancelListener = function(e) {
        if(!!scope.disableEscape) {
          e.preventDefault();
        } else {
          scope.stackable.error = 'canceled';
          scope.stackable.result = null;
        }
      };
      dialog.addEventListener('cancel', cancelListener);

      var closeListener = function(e) {
        e.stopPropagation();
        show(self.isOpen = false);
        decreaseModalCount();
        scope.$apply();
        if(scope.closed) {
          scope.closed.call(scope.$parent, {
            err: scope.stackable.error,
            result: scope.stackable.result
          });
          scope.$apply();
        }
      };
      dialog.addEventListener('close', closeListener);

      scope.$watch('show', function(value) {
        if(value) {
          if(!self.isOpen) {
            parent.append(dialog);
            if(!!scope.modal) {
              dialog.showModal();
              body.addClass('stackable-modal-open');
            } else {
              dialog.show();
            }
            self.isOpen = true;
            scope.stackable.error = scope.stackable.result = undefined;
            increaseModalCount();
          }
        } else if(self.isOpen) {
          // schedule dialog close to avoid $digest already in progress
          // as 'close' event handler may be called from here or externally
          setTimeout(function() {
            dialog.close();
            if(dialog.parentNode) {
              dialog.parentNode.removeChild(dialog);
            }
          });
          self.isOpen = false;
        }
      });

      scope.$on('$destroy', function() {
        // ensure dialog is closed
        if(self.isOpen) {
          // the stackable count must be decremented here because the
          // closeListener for this dialog was not executed
          decreaseModalCount();
          setTimeout(function() {
            dialog.close();
            if(dialog.parentNode) {
              dialog.parentNode.removeChild(dialog);
            }
          });
          self.isOpen = false;
        }
        dialog.removeEventListener('cancel', cancelListener);
        dialog.removeEventListener('close', closeListener);
        element.remove();
      });

      // close the stackable unless 'closing' callback aborts
      self.close = function(err, result) {
        var closing = scope.closing || angular.noop;
        var shouldClose = closing.call(scope.$parent, {
          err: err,
          result: result
        });
        Promise.resolve(shouldClose).then(function() {
          if(shouldClose !== false) {
            self.error = err;
            self.result = result;
            show(false);
            scope.$apply();
          }
        });
      };

      // private function for force closing modal, e.g. on `back` pressed
      self._forceClose = function() {
        scope.stackable.error = 'canceled';
        scope.stackable.result = null;
        dialog.close();
      };

      function increaseModalCount() {
        // increment total stackables count and push controller onto stack so
        // `back` button can force close the modal
        // TODO: can `body.data('stackables')` be removed entirely and
        // be replaced with `_stack.length` to determine the count?
        var count = (body.data('stackables') || 0) + 1;
        body.data('stackables', count);
        _stack.push(self);

        if(_hasHistoryAPI() && count === 1) {
          // add a history item to enable `back` button to close modals
          _stackUrl = $browser.url();
          enableBackButton();
        }
      }

      function decreaseModalCount() {
        var count = body.data('stackables') - 1;
        body.data('stackables', count);
        if(count === 0) {
          body.removeClass('stackable-modal-open');
        }
        _stack.splice(_stack.indexOf(self), 1);

        if(_hasHistoryAPI() && count === 0) {
          // remove stackables history item to restore regular `back` button
          // functionality
          if(window.history.state && window.history.state.stackables) {
            window.history.back();
            // Note: cannot see changes to `window.history.state` until next
            // tick of event loop
          }
        }
      }
    };
  }
}

function stackableCancelDirective() {
  return {
    restrict: 'AC',
    require: '^stackable',
    link: function(scope, element, attrs, ctrl) {
      element.on('click', cancel);
      scope.$on('$destroy', cleanup);
      element.on('$destroy', cleanup);

      function cancel() {
        ctrl.close('canceled', null);
      }

      function cleanup() {
        element.off('click', cancel).off('$destroy', cleanup);
      }
    }
  };
}

function stackableModalDirective() {
  return {
    require: 'stackable',
    scope: {
      closed: '&?stackableClosed',
      closing: '&?stackableClosing',
      disableEscape: '=?stackableDisableEscape',
      persist: '=?persistContent',
      show: '=stackable'
    },
    restrict: 'E',
    replace: true,
    transclude: true,
    template: ' \
      <dialog class="stackable stackable-modal stackable-fadein" \
        ng-show="show"> \
        <div class="stackable-content stackable-fadein" \
          ng-if="show || persist"> \
          <div ng-transclude></div> \
        </div> \
      </dialog>',
    link: function(scope, element, attrs, ctrl) {
      // link stackable dialog
      scope.modal = true;
      ctrl.link(scope, element);
    }
  };
}

function stackablePopoverDirective() {
  return {
    require: 'stackable',
    scope: {
      alignment: '@?stackableAlignment',
      closed: '&?stackableClosed',
      closing: '&?stackableClosing',
      disableBlurClose: '=?stackableDisableBlurClose',
      disableEscape: '=?stackableDisableEscape',
      hideArrow: '=?stackableHideArrow',
      persist: '=?persistContent',
      placement: '@?stackablePlacement',
      state: '=stackable'
    },
    restrict: 'E',
    replace: true,
    transclude: true,
    template: ' \
      <dialog class="stackable stackable-popover" ng-show="state.show"> \
        <div class="stackable-content" ng-if="state.show || persist" \
          ng-animate-children> \
          <div stackable-popover-content="onContentLinked()" \
            class="stackable-popover-content stackable-fadein" \
            style="display: none; opacity: 0" \
            ng-style="{\'z-index\': zIndex}" \
            ng-class="{ \
              \'stackable-place-top\': !placement || placement == \'top\', \
              \'stackable-place-right\': placement == \'right\', \
              \'stackable-place-bottom\': placement == \'bottom\', \
              \'stackable-place-left\': placement == \'left\', \
              \'stackable-align-center\': !alignment || \
                alignment == \'center\', \
              \'stackable-align-top\': alignment == \'top\', \
              \'stackable-align-right\': alignment == \'right\', \
              \'stackable-align-bottom\': alignment == \'bottom\', \
              \'stackable-align-left\': alignment == \'left\', \
              \'stackable-no-arrow\': hideArrow}"> \
            <div ng-if="!hideArrow" class="stackable-arrow"></div> \
            <div ng-transclude></div> \
          </div> \
        </div> \
      </dialog>',
    link: Link
  };

  function Link(scope, element, attrs, ctrl) {
    // setup `show` as a function dependent on scope.state
    scope.show = function(value) {
      if(value === undefined) {
        return scope.state.show;
      }
      scope.state.show = value;
    };

    // link stackable dialog
    ctrl.link(scope, element);

    // clean up any remaining handlers
    scope.$on('$destroy', function() {
      doc.off('keyup', closeOnEscape).off('click', closeOnClick);
    });

    // called whenever content is linked (after the popover is shown)
    var contentLinked = false;
    scope.onContentLinked = function() {
      var content = element.find('.stackable-popover-content');
      // clear `none` display style that was set in the popover template (it
      // was used to prevent flash of content); it must be cleared to allow the
      // browser to layout the popover so its dimensions can be measured prior
      // to positioning and we must delay that positioning until the next tick
      // via `setTimeout` to let the browser run that layout code
      content.css({display: ''});
      // schedule positioning to allow browser to layout
      setTimeout(function() {
        // clear initial opacity style to allow any animation to run
        content.css({opacity: ''});
        reposition(content);
        contentLinked = true;
      });
    };

    // watch state to reposition popover
    scope.$watch('state', watchState, true);

    var doc = angular.element(document);
    function watchState(newState, oldState) {
      if(!newState) {
        return;
      }

      if(newState.show) {
        if(!oldState.show || newState === oldState) {
          // just shown, add handlers to close when pressing escape anywhere
          // or clicking away
          doc.keyup(closeOnEscape).click(closeOnClick);
        }
        if(contentLinked) {
          reposition();
        }
      } else {
        if(oldState.show || newState === oldState) {
          // just hidden, remove handlers
          doc.off('keyup', closeOnEscape).off('click', closeOnClick);
          if(!scope.persist) {
            contentLinked = false;
          }
        }
      }
    }

    function closeOnClick(e) {
      // close if target is not in the popover and trigger was not clicked
      // (also clear trigger click status)
      var target = angular.element(e.target);
      var triggerClicked = scope.state.triggerClicked;
      scope.state.triggerClicked = false;
      if(!triggerClicked && target.closest(element).length === 0) {
        scope.state.show = false;
        scope.$apply();
      }
    }

    function closeOnEscape(e) {
      if(!scope.disableEscape && e.keyCode === 27) {
        e.stopPropagation();
        scope.state.show = false;
        scope.$apply();
      }
    }

    function reposition(content) {
      if(!content) {
        content = element.find('.stackable-popover-content');
      }

      var width = content.outerWidth(false);
      var height = content.outerHeight(false);

      // ensure z-index is above parent dialog
      var parentDialog = content.parent().closest('dialog');
      // JQuery in WebKit browsers does not give back a z-index value if
      // an element's position is not explicitly set. Retrieve it from
      // the style instead.
      // https://bugs.jquery.com/ticket/9667
      //var zIndex = parentDialog.css('z-index');
      var zIndex = parentDialog.prop('style')['zIndex'];
      var zIndexInt = parseInt(zIndex, 10);
      if(zIndexInt.toString() !== zIndex) {
        zIndex = 0;
      }

      // calculate offset delta between content and its trigger element
      // and any delta between content offset and position
      content.css({
        top: scope.state.position.top,
        left: scope.state.position.left,
        'z-index': zIndex + 1
      });
      var offset = content.offset();
      var position = content.position();
      var delta = {
        top: (scope.state.position.top - offset.top) +
          (offset.top - position.top),
        left: (scope.state.position.left - offset.left) +
          (offset.left - position.left)
      };

      // position popover content
      position = {top: 0, left: 0};
      var alignment = scope.alignment || 'center';
      var placement = scope.placement || 'top';
      if(placement === 'top' || placement === 'bottom') {
        // treat invalid 'top' or 'bottom' as 'center'
        if(['center', 'top', 'bottom'].indexOf(alignment) !== -1) {
          var triggerCenterX = (scope.state.position.left +
            scope.state.position.width / 2);
          position.left = triggerCenterX - width / 2;
        } else if(alignment === 'left') {
          position.left = scope.state.position.left;
        } else {
          // alignment 'right'
          position.left = (scope.state.position.left +
            scope.state.position.width - width);
        }
        position.top = scope.state.position.top;
        if(placement === 'top') {
          position.top -= height;
        } else {
          position.top += scope.state.position.height;
        }
      } else {
        // else placement is 'left' or 'right'

        // treat invalid 'left' or 'right' as 'center'
        if(['center', 'left', 'right'].indexOf(alignment) !== -1) {
          var triggerCenterY = (scope.state.position.top +
            scope.state.position.height / 2);
          position.top = triggerCenterY - height / 2;
        } else if(alignment === 'top') {
          position.top = scope.state.position.top;
        } else {
          // alignment 'bottom'
          position.top = (scope.state.position.top +
            scope.state.position.height - height);
        }
        position.left = scope.state.position.left;
        if(placement === 'left') {
          position.left -= width;
        } else {
          position.left += scope.state.position.width;
        }
      }

      // apply final position
      position.top = (position.top + delta.top) + 'px';
      position.left = (position.left + delta.left) + 'px';
      content.css(position);
    }
  }
}

function stackablePopoverContentDirective() {
  return {
    restrict: 'A',
    scope: {
      onLink: '&stackablePopoverContent'
    },
    link: Link
  };

  function Link(scope) {
    // notify of linkage
    scope.onLink();
  }
}

function stackableTriggerDirective($parse) {
  return {
    restrict: 'A',
    link: Link
  };

  function Link(scope, element, attrs) {
    // track stackable state
    var state = {};
    var toggleClasses = '';
    initState(attrs.stackableTrigger);
    attrs.$observe('stackableTrigger', function(value) {
      initState(value);
    });
    attrs.$observe('stackableToggle', function(value) {
      toggleClasses = $parse(value)(scope);
    });

    // update state and add/remove toggle classes when state.show changes
    scope.$watch(function() {
      return state.show;
    }, function(value) {
      updateState(state);
      if(toggleClasses) {
        element.toggleClass(toggleClasses, !!value);
      }
    });

    // ensure event handlers are cleaned up
    scope.$on('$destroy', cleanup);
    element.on('$destroy', cleanup);

    // update element position when window resized
    angular.element(window).resize(resize);

    var toggleEvent = attrs.stackableToggle || 'click';
    if(toggleEvent === 'hover') {
      // show on enter, hide on leave
      element.on('mouseenter', enter).on('mouseleave', leave);
    } else {
      // default to click
      element.on('click', click);
    }

    function resize() {
      updateState(state);
      scope.$apply();
    }

    function enter() {
      setVisible(true);
    }

    function leave() {
      setVisible(false);
    }

    function setVisible(show) {
      state.show = show;
      updateState(state);
      scope.$apply();
    }

    function click() {
      // indicate trigger was clicked
      state.triggerClicked = true;
      state.show = !state.show;
      updateState(state);
      scope.$apply();
    }

    function cleanup() {
      angular.element(window).off('resize', resize);
      element
        .off('mouseenter', enter)
        .off('mouseleave', leave)
        .off('click', click)
        .off('$destroy', cleanup);
    }

    function initState(expr) {
      var get = $parse(expr);
      var set = get.assign || angular.noop;
      state = get(scope);
      if(!state) {
        state = {};
        set(scope, state);
      }
      if(!('show' in state)) {
        state.show = false;
      }
      updateState(state);
    }

    function updateState(state) {
      var offset = element.offset();
      var scrollOffset = angular.element(document).scrollTop();
      state.position = {
        top: offset.top,
        left: offset.left,
        height: element.outerHeight(false),
        width: element.outerWidth(false),
        heightWithMargin: element.outerHeight(true),
        widthWithMargin: element.outerWidth(true)
      };
    }
  }
}

} // end init() definition

if(typeof define === 'function' && 'amd' in define) {
  // AMD support
  define(['angular', 'dialog-polyfill'], function(angular, dialogPolyfill) {
    init(angular, dialogPolyfill);
  });
} else if(typeof module === 'object' && typeof module.exports === 'object') {
  // CommonJS support
  init(require('angular'), require('dialog-polyfill'));
} else {
  // all others
  init(window.angular, window.dialogPolyfill);
}

})();
