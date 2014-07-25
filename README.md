angular-stackables
==================

AngularJS stackable widgets (modals, popovers, menus) that use HTML5 dialog

# Examples

## A simple modal

```html
<div ng-controller="TestController as test">
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

## A simple popover

```html
<div ng-controller="TestController as test">
  <a class="btn" stackable-trigger="test.popoverState">
    <i class="caret"></i>
  </a>

  <div stackable-popover="test.popoverState"
    stackable-placement="bottom"
    stackable-alignment="center"
    stackable-enable-escape="true">
    <h3 class="stackable-popover-title">Title</h3>
    <div class="stackable-popover-body">
      <p>Hello World</p>
    </div>
  </div>
</div>
```

## A simple menu

```html
<div ng-controller="TestController as test">
  <a class="btn" stackable-trigger="test.menuState">
    <i class="caret"></i>
  </a>

  <div stackable-popover="test.menuState"
    stackable-hide-arrow="true"
    stackable-placement="bottom"
    stackable-alignment="right"
    stackable-enable-escape="true">
    <ul class="stackable-menu">
      <li>
        <a href="#">Menu Item</a>
      </li>
    </ul>
  </div>
</div>
```
