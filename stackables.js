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

module.directive({'stackable': factory});

function factory() {
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
      <dialog class="stackable"> \
        <div data-ng-if="show" class="stackable-content"> \
          <div data-ng-transclude></div> \
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

return {stackable: factory};

})();
