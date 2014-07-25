/*!
 * Stackables module.
 *
 * Copyright (c) 2014 Digital Bazaar, Inc. All rights reserved.
 *
 * @author Dave Longley
 */
(function() {

'use strict';

var module = angular.module('stackables', []);

module.directive({stackable: stackableDirective});
module.directive({stackableCancel: stackableCancelDirective});
module.directive({stackablePopover: stackablePopoverDirective});
module.directive({stackableTrigger: ['$parse', stackableTriggerDirective]});

function stackableDirective() {
  return {
    scope: {
      show: '=stackable',
      modal: '=?stackableModal',
      persist: '=?persistContent',
      disableEscape: '=?stackableDisableEscape',
      closing: '&?stackableClosing',
      closed: '&?stackableClosed'
    },
    restrict: 'A',
    replace: true,
    transclude: true,
    template: ' \
      <dialog class="stackable" ng-class="{\'stackable-modal\': modal}" \
        ng-show="show"> \
        <div ng-if="show || persist" class="stackable-content"> \
          <div ng-transclude></div> \
        </div> \
      </dialog>',
    controller: ['$scope', Controller],
    link: Link
  };

  function Controller($scope) {
    var self = this;
    var stackable = $scope.stackable = self;

    // close the stackable unless 'closing' callback aborts
    self.close = function(err, result) {
      var closing = $scope.closing || angular.noop;
      var shouldClose = closing.call($scope.$parent, {
        err: err,
        result: result
      });
      Promise.resolve(shouldClose).then(function() {
        if(shouldClose !== false) {
          stackable.error = err;
          stackable.result = result;
          $scope.show = false;
          $scope.$apply();
        }
      });
    };
  }

  function Link(scope, element) {
    var open = false;
    var body = angular.element('body');
    var dialog = element[0];
    // use polyfill if necessary
    if(!dialog.showModal && typeof dialogPolyfill !== 'undefined') {
      dialogPolyfill.registerDialog(dialog);
    }

    dialog.addEventListener('cancel', function(e) {
      if(!!scope.disableEscape) {
        e.preventDefault();
      } else {
        scope.stackable.error = 'canceled';
        scope.stackable.result = null;
      }
    });

    dialog.addEventListener('close', function(e) {
      e.stopPropagation();
      scope.show = open = false;
      var count = body.data('stackables') - 1;
      body.data('stackables', count);
      if(count === 0) {
        body.removeClass('stackable-modal-open');
      }
      scope.$apply();
      if(scope.closed) {
        scope.closed.call(scope.$parent, {
          err: scope.stackable.error,
          result: scope.stackable.result
        });
      }
    });

    scope.$watch('show', function(value) {
      if(value) {
        if(!open) {
          if(!!scope.modal) {
            dialog.showModal();
            body.addClass('stackable-modal-open');
          } else {
            dialog.show();
          }
          open = true;
          scope.stackable.error = scope.stackable.result = undefined;
          var count = body.data('stackables') || 0;
          body.data('stackables', count + 1);
        }
      } else if(open) {
        // schedule dialog close to avoid $digest already in progress
        // as 'close' event handler may be called from here or externally
        setTimeout(function() {
          dialog.close();
        });
        open = false;
      }
    });
  }
}

function stackableCancelDirective() {
  return {
    restrict: 'AC',
    require: '^stackable',
    link: function(scope, element, attrs, ctrl) {
      element.on('click', function() {
        ctrl.close('canceled', null);
      });
    }
  };
}

function stackablePopoverDirective() {
  return {
    scope: {
      state: '=stackablePopover',
      hideArrow: '=?stackableHideArrow',
      alignment: '@?stackableAlignment',
      placement: '@?stackablePlacement',
      enableEscape: '=?stackableEnableEscape',
      disableBlurClose: '=?stackableDisableBlurClose'
    },
    restrict: 'A',
    replace: true,
    transclude: true,
    template: ' \
      <div> \
        <div stackable="state.show" class="stackable-popover"> \
          <div class="stackable-popover-content" style="display:none" \
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
      </div>',
    link: Link
  };

  function Link(scope, element) {
    var doc = angular.element(document);
    scope.$watch('state', function(state) {
      if(state) {
        if(state.show) {
          // close when pressing escape anywhere or clicking away
          doc.keyup(closeOnEscape).click(closeOnClick);
        } else {
          doc.off('keyup', closeOnEscape).off('click', closeOnClick);
        }
      }

      // schedule repositioning
      setTimeout(function() {
        // only reposition if content is shown
        var content = element.find('.stackable-popover-content');
        if(!content.length) {
          return;
        }
        reposition(content);
      });
    }, true);

    // clean up any remaining handlers
    scope.$on('$destroy', function() {
      doc.off('keyup', closeOnEscape).off('click', closeOnClick);
    });

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
      if(scope.enableEscape && e.keyCode === 27) {
        e.stopPropagation();
        scope.state.show = false;
        scope.$apply();
      }
    }

    function reposition(content) {
      content.css('display', 'none');
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
      content.css('display', '');
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
    var state;
    var toggleClasses = '';
    initState(attrs.stackableTrigger);
    attrs.$observe('stackableTrigger', function(value) {
      initState(value);
    });
    attrs.$observe('stackableToggle', function(value) {
      toggleClasses = $parse(value)(scope);
    });

    // update element position when window resized
    angular.element(window).resize(resized);
    scope.$on('$destroy', function() {
      angular.element(window).off('resize', resized);
    });

    // add/remove toggle classes when state.show changes
    scope.$watch(function() {
      return state.show;
    }, function(value) {
      if(toggleClasses) {
        if(value === true) {
          element.addClass(toggleClasses);
        } else {
          element.removeClass(toggleClasses);
        }
      }
    });

    var toggleEvent = attrs.stackableToggle || 'click';
    if(toggleEvent === 'hover') {
      // show on enter, hide on leave
      element.hover(function() {
        state.show = true;
        updateState(state);
        scope.$apply();
      }, function() {
        state.show = false;
        updateState(state);
        scope.$apply();
      });
    } else {
      // default to click
      element.on('click', function() {
        // clear any selection
        if(document.selection && document.selection.empty) {
          document.selection.empty();
        } else if(window.getSelection) {
          window.getSelection().removeAllRanges();
        }

        // indicate trigger was clicked
        state.triggerClicked = true;
        state.show = !state.show;
        updateState(state);
        scope.$apply();
      });
    }

    function resized() {
      updateState(state);
      scope.$apply();
    }

    function initState(expr) {
      var get = $parse(expr);
      var set = get.assign || angular.noop;
      state = get(scope) || {};
      if(!('show' in state)) {
        state.show = false;
      }
      updateState(state);
      set(scope, state);
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
      return state;
    }
  }
}

})();
