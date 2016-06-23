/*!
 * Stackables module.
 *
 * Copyright (c) 2014-2016 Digital Bazaar, Inc. All rights reserved.
 *
 * @author Dave Longley
 */
(function() {

'use strict';

var module = angular.module('stackables', []);

module.directive({stackable: stackableDirective});
module.directive({stackableCancel: stackableCancelDirective});
module.directive({stackableModal: stackableModalDirective});
module.directive({stackablePopover: stackablePopoverDirective});
module.directive({stackableTrigger: ['$parse', stackableTriggerDirective]});

var usePolyfill = angular.element('<dialog></dialog>');
usePolyfill = (!usePolyfill[0].showModal &&
  typeof dialogPolyfill !== 'undefined');

function stackableDirective() {
  return {
    restrict: 'A',
    controller: Controller
  };

  function Controller() {
    var self = this;

    // link the dialog element
    self.link = function(scope, element) {
      scope.stackable = self;

      self.isOpen = false;
      var body = angular.element('body');
      var dialog = element[0];
      var parent;

      // get z-index of parent dialog, if any
      var parentDialog = element.parent().closest('dialog');
      if(parentDialog.length === 0) {
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
        scope.show = self.isOpen = false;
        decreaseModalCount();
        scope.$digest();
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
            var count = body.data('stackables') || 0;
            body.data('stackables', count + 1);
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
            scope.show = false;
            scope.$apply();
          }
        });
      };

      function decreaseModalCount() {
        var count = body.data('stackables') - 1;
        body.data('stackables', count);
        if(count === 0) {
          body.removeClass('stackable-modal-open');
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
      <dialog class="stackable stackable-popover" ng-show="show"> \
        <div class="stackable-content" ng-if="show || persist" \
          ng-animate-children> \
          <div class="stackable-popover-content stackable-fadein" \
            style="display: none; opacity: 0" \
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
    // link stackable dialog
    ctrl.link(scope, element);

    // popover not positioned yet
    var positioned = false;

    // watch state to reposition popover
    scope.$watch('state', watchState, true);

    // keep scope.state.show in-sync with show
    scope.$watch('show', function(value) {
      if(value !== undefined && scope.state) {
        scope.state.show = value;
      }
    });

    // clean up any remaining handlers
    scope.$on('$destroy', function() {
      doc.off('keyup', closeOnEscape).off('click', closeOnClick);
    });

    var doc = angular.element(document);
    function watchState(state) {
      if(state) {
        scope.show = state.show;
        if(state.show) {
          // close when pressing escape anywhere or clicking away
          if(!positioned) {
            doc.keyup(closeOnEscape).click(closeOnClick);
          }
        } else {
          doc.off('keyup', closeOnEscape).off('click', closeOnClick);
          positioned = false;
        }
      }

      // schedule repositioning
      setTimeout(repositionIfShown);
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

    function repositionIfShown() {
      // only reposition if content is shown
      var content = element.find('.stackable-popover-content');
      if(!content.length) {
        return;
      }
      reposition(content);
    }

    function reposition(content) {
      var width = content.outerWidth(false);
      var height = content.outerHeight(false);

      // position popover content
      var position = {top: 0, left: 0};
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
      position.top += 'px';
      position.left += 'px';
      content.css(position);
      if(!positioned) {
        content.css({display: '', opacity: ''});
        positioned = true;
        scope.$digest();
      }
    }
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

})();
