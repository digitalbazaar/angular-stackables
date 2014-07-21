angular-stackables
==================

AngularJS stackable widgets (modals, popovers, menus) that use HTML5 dialog

# Examples

```html
<div ng-controller="TestController as page">
  <div stackable="test.isOpen"
    stackable-modal="true"
    stackable-disable-escape="false"
    stackable-closing="test.modalClosing(err, result)"
    stackable-closed="test.modalClosed(err, result)">
    <div class="stackable-dialog">
      <div inner-directive>
        <p>Test Dialog</p>
      </div>
    </div>
  </div>
</div>
```

```js
function TestController() {
  this.isOpen = false;

  this.modalClosing = function(err, result) {
    /* return false or a Promise that resolves to false to prevent close */
    return true;
  };

  this.modalClosed = function(err, result) {
    console.log('modal closed', err, result);
  };
}

module.directive({
  innerDirective: function() {
    return {
      restrict: 'A',
      require: '^stackable',
      replace: true,
      transclude: true,
      template: '<div ng-transclude></div>',
      link: function(scope, element, attrs, ctrl) {
        // use stackable controller API to close stackable programmatically
        ctrl.close(null, 'closed from inner directive');
      }
    };
  }
});
```
