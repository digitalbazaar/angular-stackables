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
module.directive({
  stackablePopoverTrigger: ['$parse', stackablePopoverTriggerDirective]
});

function stackableDirective() {
  return {
    scope: {
      show: '=stackable',
      modal: '=?stackableModal',
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
        <div ng-if="show" class="stackable-content"> \
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

function stackableDirective() {
  return {
    scope: {
      show: '=stackable',
      modal: '=?stackableModal',
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
        <div ng-if="show" class="stackable-content"> \
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
    restrict: 'A',
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
      placement: '@?stackablePlacement',
      enableEscape: '=?stackableEnableEscape',
      disableBlurClose: '=?stackableDisableBlurClose'
    },
    restrict: 'A',
    replace: true,
    transclude: true,
    template: ' \
      <div class="stackable-popover" ng-class="{ \
        \'stackable-top\': !placement || placement == \'top\', \
        \'stackable-right\': placement == \'right\', \
        \'stackable-bottom\': placement == \'bottom\', \
        \'stackable-left\': placement == \'left\'}"> \
        <div stackable="state.show"> \
          <div class="stackable-popover-content"> \
            <div class="stackable-arrow"></div> \
            <div ng-transclude></div> \
          </div> \
        </div> \
      </div>',
    compile: Compile
  };

  function Compile(tElement, tAttrs, transcludeFn) {
    var extents = {};
    return function(scope, element) {
      // measure popover content
      transcludeFn(scope.$parent, function(clone) {
        var content = angular.element(' \
          <div class="stackable-popover-content" style="width:auto"> \
            <div class="stackable-arrow"></div> \
          </div>');
        content.append(clone);
        content.css({display: 'none'});
        angular.element('body').append(content);
        extents.height = content.outerHeight(true);
        extents.width = content.outerWidth(true);
        // setTimeout hack to ensure content size has settled on chrome
        setTimeout(function() {
          extents.height = content.outerHeight(true);
          extents.width = content.outerWidth(true);
          content.remove();
        });
      });

      // whenever trigger state changes, reposition popover
      scope.$watch('state', function() {
        setTimeout(reposition);
      }, true);

      // close when pressing escape anywhere or clicking away
      angular.element(document)
        .on('keyup', closeOnEscape)
        .on('click', closeOnClick);
      scope.$on('$destroy', function() {
        angular.element(document)
          .off('keyup', closeOnEscape)
          .off('click', closeOnClick);
      });

      function closeOnClick(e) {
        // close if target is not the trigger and is not in the popover
        var target = angular.element(e.target);
        var trigger = target.data('stackable-popover-state');
        if(scope.state !== trigger && target.closest(element).length === 0) {
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

      function reposition() {
        // resize popover content
        var content = element.find('.stackable-popover-content');
        if(!content.length) {
          return;
        }
        content.css(extents);
        var height = content.outerHeight(true);
        var width = content.outerWidth(true);

        // position popover
        var position = {top: 0, left: 0};
        if(scope.placement === 'top' || scope.placement === 'bottom') {
          var triggerCenterX = (scope.state.position.left +
            scope.state.position.width / 2);
          position.left = triggerCenterX - width / 2;
          position.top = scope.state.position.top;
          if(scope.placement === 'top') {
            position.top -= height;
          } else {
            position.top += scope.state.position.height;
          }
        } else {
          // 'left' or 'right'
          var triggerCenterY = (scope.state.position.top +
            scope.state.position.height / 2);
          position.top = triggerCenterY - height / 2;
          position.left = scope.state.position.left;
          if(scope.placement === 'left') {
            position.left -= width;
          } else {
            position.left += scope.state.position.width;
          }
        }
        position.top += 'px';
        position.left += 'px';
        element.css(position);
      }
    };
  }
}

function stackablePopoverTriggerDirective($parse) {
  return {
    restrict: 'A',
    link: Link
  };

  function Link(scope, element, attrs) {
    // track popover state
    var state;
    initState(attrs.stackablePopoverTrigger);
    attrs.$observe('stackablePopoverTrigger', function(value) {
      initState(value);
    });

    // update element position when window resized
    angular.element(window).resize(resized);
    scope.$on('$destroy', function() {
      angular.element(window).off('resize', resized);
    });

    // toggle show on click
    element.on('click', function() {
      scope.$apply(function() {
        state.show = !state.show;
        updateState(state);
      });
    });

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
      element.data('stackable-popover-state', state);
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
