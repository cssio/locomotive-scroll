/* jshint esnext: true */
import { $window , $document , $body} from '../utils/environment';
import Resize from 'throttled-resize';

/**
 * Manage animation of elements on the page according to scroll position.
 *
 * @todo  Manage some options (normally from data attributes) with constructor options (ex.: set repeat for all)
 * @todo  Method to get the distance (as percentage) of an element in the viewport
 */
export default class {
    constructor() {

        this.scroll = {
            x: 0,
            y: 0,
            direction: ''
        }

        window.App.scroll = this.scroll;

        this.windowHeight = $window.height();
        this.windowMiddle = this.windowHeight / 2;

        this.selector = '.js-anim';

        // Set the scrollable container for the smoothscroll module
        this.$el = $('#js-scroll');

        this.animatedElements = [];

        this.requestId = undefined;

        this.resize = new Resize();

        // Add element event
        $document.on('addElement.Scroll', (event) => this.addElementsWithCallbacks(event.selector, event.callbacks));

        // Render event
        $document.on('render.Scroll', () => this.renderAnimations(false));

        // Update event
        $document.on('update.Scroll', (event, options) => this.updateElements(options));

        // ScrollTo event
        $document.on('scrollTo.Scroll', (options) => this.scrollTo(options.value));

        // Resize event
        this.resize.on('resize:end', () => this.updateElements());

        this.init();
    }

    /**
     * Basic initialization of scrolling animations.
     */
    init(){
        this.addElements();

        // Rebuild event
        $document.on('rebuild.Scroll', () => {
            this.scrollTo(0);
            this.updateElements();
        });
    }

    /**
     * Find all animatable elements.
     * Called on page load and any subsequent updates.
     */
    addElements() {
        this.animatedElements = [];

        var $elements = $(this.selector);
        var i = 0;
        var len = $elements.length;

        for (; i < len; i ++) {
            let model = this.getElementModel($elements.eq(i));

            // Don't add element if it already has its in view class and doesn't repeat
            if (model.repeat || !model.$element.hasClass(model.inViewClass)) {
                this.animatedElements.push(model);
            }
        };

        this.requestId = window.requestAnimationFrame(() => this.renderAnimations());
    }

    /**
     * Manually add one or more elements to the animated elements array
     * @param {String} selector
     * @param {Object} callbacks
     * @see https://github.com/jeremenichelli/hunt/blob/master/src/hunt.js
     */
    addElementsWithCallbacks(selector, callbacks) {
        var $elements = $(selector);
        var i = 0;
        var len = $elements.length;

        // Add elements to animated elements array
        for (; i < len; i++) {
            let model = this.getElementModel($elements.eq(i));
            model.callbacks = callbacks;

            this.animatedElements.push(model);
        }

        i = len = null;
    }

    /**
     * Loop through all animatable elements and apply animation method(s).
     */
    animateElements() {
        var len = this.animatedElements.length;
        var i = 0;
        var removeIndexes = [];
        for (; i < len; i++) {
            let element = this.animatedElements[i];

            // If the element's visibility must not be manipulated any further, remove it from the list
            if (this.validateElementVisibility(element, i)) {
                removeIndexes.push(i);
            }
        }

        // Remove animated elements after looping through elements
        i = removeIndexes.length;
        while (i--) {
            this.animatedElements.splice(removeIndexes[i], 1);
        }
    }

    /**
     * Pseudo constructor for element that is animated/transformed.
     * @param  {jQueryNode} $element
     * @return {Object}
     */
    getElementModel($element) {
        var elementTarget = $element.data('target');
        var $target = (elementTarget) ? $(elementTarget) : $element;
        var elementOffset = $target.offset().top;
        var elementLimit = elementOffset + $element.outerHeight();

        // If elements loses its animation after scrolling past it
        var elementRepeat = (typeof $element.data('repeat') === 'string');

        var elementInViewClass = $element.data('inview-class');
        if (typeof elementInViewClass === 'undefined') {
            elementInViewClass = 'is-show';
        }

        return {
            $element: $element,
            callbacks: {
                // noop methods
                enter: function() {},
                out: function() {}
            },
            inViewClass: elementInViewClass,
            offset: Math.round(elementOffset),
            limit: elementLimit,
            repeat: elementRepeat,
            $target: $target
        };
    }

    /**
     * Render the class animations, and update the global scroll positionning.
     */
    renderAnimations() {
        if (window.pageYOffset > this.scroll.y) {
            if (this.scroll.direction !== 'down') {
                this.scroll.direction = 'down';
            }
        } else if (window.pageYOffset < this.scroll.y) {
            if (this.scroll.direction !== 'up') {
                this.scroll.direction = 'up';
            }
        }

        if (this.scroll.y !== window.pageYOffset) {
            this.scroll.y = window.pageYOffset;
        }
        if (this.scroll.x !== window.pageXOffset) {
            this.scroll.x = window.pageXOffset;
        }

        this.animateElements();

        this.requestId = window.requestAnimationFrame(() => this.renderAnimations());
    }

    /**
     * Scroll to a desired target.
     *
     * @param  {object|int} target Either a jQuery element or a `y` position
     * @return {void}
     */
    scrollTo(target) {
        var targetOffset = 0;
        if (target instanceof jQuery && target.length > 0) {
            var targetData;

            if (target.data('target')) {
                targetData = target.data('target');
            } else {
                targetData = target.attr('href');
            }

            targetOffset = $(targetData).offset().top + this.scrollbar.scrollTop;
        } else {
            targetOffset = target;
        }

        $body.animate({
            scrollTop:targetOffset
        }, 'slow');
    }

    /**
     * Update elements and recalculate all the positions on the page
     */
    updateElements() {
        this.addElements();
    }

    /**
     * Validate the visibility of an element and perform various operations related to its state.
     *
     * @param  {object}      element Current element to test
     * @param  {int}         index   Index of the element within it's container
     * @return {boolean}             Wether the item must be removed from its container
     */
    validateElementVisibility(element, index) {
        var removeFromContainer = false;

        if (typeof element !== 'undefined') {
            // Find the bottom edge of the scroll container
            var scrollBottom = this.scroll.y + this.windowHeight;

            // Define if the element is inView
            var inView = (scrollBottom >= element.offset && this.scroll.y <= element.limit);

            // Add class if inView, remove if not
            if (inView) {
                element.$element.addClass(element.inViewClass);
                element.callbacks.enter.apply(element);

                if (!element.repeat){
                    removeFromContainer = true;
                }
            } else if (element.repeat) {
                element.$element.removeClass(element.inViewClass);
                element.callbacks.out.apply(element);
            }
        }

        return removeFromContainer;
    }

    /**
     * Destroy
     */
    destroy() {
        this.resize.destroy();
        $document.off('.Scroll');
        this.$el.off('.Scroll');
        window.cancelAnimationFrame(this.requestId);
        this.requestId = undefined;
        this.animatedElements = undefined;
    }
}
