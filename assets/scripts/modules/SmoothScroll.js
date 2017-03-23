import { $window , $document , $body} from '../utils/environment';
import Scroll from './Scroll';
import Scrollbar from 'smooth-scrollbar';
import Resize from 'throttled-resize';

import { isNumeric } from '../utils/is';

/**
 * Smooth scrolling using `smooth-scrollbar`.
 * Based on `Scroll` class, which allows animations of elements on the page
 * according to scroll position.
 *
 * @todo  Method to get the distance (as percentage) of an element in the viewport
 */
export default class extends Scroll {
    constructor() {
        super();

        this.scrollbar;
    }

    /**
     * Initialize scrolling animations
     */
    init() {
        // Add class to the body to know if SmoothScroll is initialized (to manage overflow on containers)
        $body.addClass('has-smooth-scroll');

        this.scrollbar = Scrollbar.init(this.$el[0]);

        this.setScrollbarLimit();

        this.parallaxElements = [];

        this.addElements();

        this.renderAnimations(true);

        // On scroll
        this.scrollbar.addListener(() => this.renderAnimations(false));

        // Rebuild event
        $document.on('rebuild.Scroll', () =>{
            this.updateElements();
        });

        // Scrollto button event
        $('.js-scrollto').on('click.Scroll', (event) => {
            event.preventDefault();
            this.scrollTo($(event.currentTarget));
        });

        // Setup done
        $document.triggerHandler('isReady.Scroll');
    }

    /**
     * Reset existing elements and find all animatable elements.
     * Called on page load and any subsequent updates.
     */
    addElements() {
        this.animatedElements = [];
        this.parallaxElements = [];

        var $elements = $(this.selector);
        var i = 0;
        var len = $elements.length;

        for (; i < len; i ++) {
            let model = this.getElementModel($elements.eq(i));

            // For parallax animated elements
            if (model.speed !== false) {
                model.middle = ((model.limit - model.offsetRaw) / 2) + model.offsetRaw;
                model.offset = model.offsetRaw;

                this.parallaxElements.push(model);
            } else {
                // Don't add element if it already has its in view class and doesn't repeat
                if (model.repeat || !model.$element.hasClass(model.inViewClass)) {
                    this.animatedElements.push(model);
                }
            }
        }
    }

    /**
     * Pseudo constructor for element that is animated/transformed.
     * @param  {jQueryNode} $element
     * @return {Object}
     */
    getElementModel($element) {
        var model = super.getElementModel($element);

        var elementSpeed = isNumeric($element.data('speed')) ? parseInt($element.data('speed')) / 10 : false
        var elementPosition = $element.data('position');
        var elementHorizontal = $element.data('horizontal');

        var elementOffset = model.$target.offset().top + this.scrollbar.scrollTop;
        var elementLimit = elementOffset + model.$target.outerHeight();

        if (!model.$target && $element.data('transform')) {
            elementOffset -= parseFloat($element.data('transform').y);
        }

        return $.extend({}, model, {
            horizontal: elementHorizontal,
            limit: elementLimit,
            offset: Math.round(elementOffset),
            offsetRaw: elementOffset,
            position: elementPosition,
            speed: elementSpeed
        });
    }

    /**
     * Render the class/transform animations, and update the global scroll positionning.
     *
     * @param  {boolean} isFirstCall Determines if this is the first occurence of method being called
     * @return {void}
     */
    renderAnimations(isFirstCall) {
        var scrollbarTop = this.scrollbar.scrollTop;

        if (scrollbarTop > this.scroll.y) {
            if (this.scroll.direction !== 'down') {
                this.scroll.direction = 'down';
            }
        } else if (scrollbarTop < this.scroll.y) {
            if (this.scroll.direction !== 'up') {
                this.scroll.direction = 'up';
            }
        }

        if (this.scroll.y !== scrollbarTop) {
            this.scroll.y = scrollbarTop;
        }

        this.transformElements(isFirstCall);
        this.animateElements();

        window.App.scroll = this.scroll;
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

        this.scrollbar.scrollTo(0, targetOffset, 900);
    }

    /**
     * Set the scroll bar limit
     */
    setScrollbarLimit() {
        this.scrollbarLimit = this.scrollbar.limit.y + this.windowHeight;
    }

    /**
     * Apply CSS transform properties on an element.
     *
     * @param  {object}  $element Targetted jQuery element
     * @param  {int}     x        Translate value
     * @param  {int}     y        Translate value
     * @param  {int}     z        Translate value
     * @return {void}
     */
    transformElement($element, x, y, z) {
        // Defaults
        x = x || 0;
        y = y || 0;
        z = z || 0;

        // Translate and store the positionning as `data`
        $element.css({
            '-webkit-transform': 'translate3d('+ x +', '+ y +', '+ z +')',
            '-ms-transform': 'translate3d('+ x +', '+ y +', '+ z +')',
            'transform': 'translate3d('+ x +', '+ y +', '+ z +')'
        }).data('transform',{
            x : x,
            y : y,
            z : z
        });

        // Affect child elements with the same positionning
        var children = $element.find(this.selector);
        var i = 0;
        var len = children.length;
        for (; i < len; i++) {
            let $child = $(children[i]);
            if (!$child.data('transform')) {
                $child.data('transform', {
                    x : x,
                    y : y,
                    z : z
                })
            }
        };
    }

    /**
     * Loop through all parallax-able elements and apply transform method(s).
     *
     * @param  {boolean} isFirstCall Determines if this is the first occurence of method being called
     * @return {void}
     */
    transformElements(isFirstCall) {
        if (this.parallaxElements.length > 0) {
            var scrollbarBottom = this.scrollbar.scrollTop + this.windowHeight;
            var scrollbarMiddle = this.scrollbar.scrollTop + this.windowMiddle;

            var i = 0;
            var len = this.parallaxElements.length;
            var removeIndexes = [];

            for (; i < len; i++) {
                let curEl = this.parallaxElements[i];
                // Old
                let scrollBottom = scrollbarBottom;
                // New
                // let scrollBottom = (curEl.position === 'top') ? this.scrollbar.scrollTop : scrollbarBottom;

                let transformDistance = false;

                // Define if the element is in view
                // Old
                let inView = (scrollBottom >= curEl.offset && this.scroll.y <= curEl.limit);
                // New
                // let inView = (scrollBottom >= curEl.offset && this.scrollbar.scrollTop <= curEl.limit);

                // Add class if in view, remove if not
                if (inView) {
                    curEl.$element.addClass('is-inview');

                    if (curEl.repeat === false) {
                        curEl.$element.addClass('is-visible');
                    }
                } else {
                    curEl.$element.removeClass('is-inview');
                }

                this.validateElementVisibility(curEl, i);

                if (isFirstCall && !inView && curEl.speed) {
                    // Different calculations if it is the first call and the item is not in the view
                    if (curEl.position !== 'top') {
                        transformDistance = (curEl.offset - this.windowMiddle - curEl.middle) * -curEl.speed;
                    }
                }

                // If element is in view
                if (inView && curEl.speed) {
                    switch (curEl.position) {
                        case 'top':
                            // Old
                            transformDistance = this.scrollbar.scrollTop * -curEl.speed;
                            // New
                            // transformDistance = (this.scrollbar.scrollTop - curEl.offset) * -curEl.speed;
                        break;

                        case 'bottom':
                            transformDistance = (this.scrollbarLimit - scrollBottom) * curEl.speed;
                        break;

                        default:
                            transformDistance = (scrollbarMiddle - curEl.middle) * -curEl.speed;
                        break;
                    }
                }

                // Transform horizontal OR vertical. Defaults to vertical
                if (isNumeric(transformDistance)) {
                    (curEl.horizontal) ?
                        this.transformElement(curEl.$element, transformDistance + 'px') :
                        this.transformElement(curEl.$element, 0, transformDistance + 'px');
                }
            }
        }
    }

    /**
     * Update elements and recalculate all the positions on the page
     *
     * @param {object} options
     */
    updateElements(options) {
        options = options || {};

        this.scrollbar.update();
        this.windowHeight = $window.height();
        this.windowMiddle = this.windowHeight / 2;
        this.setScrollbarLimit();
        this.addElements();

        if (typeof options.callback === 'function') {
            options.callback();
        }
    }

    /**
     * Destroy
     */
    destroy() {
        this.parallaxElements = undefined;
        this.scrollbar.destroy();
        super.destroy();
    }
}
