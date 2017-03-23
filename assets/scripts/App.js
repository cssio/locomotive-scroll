/* jshint esnext: true */
import { $document, $body } from './utils/environment';
import Scroll from './modules/Scroll';
import SmoothScroll from './modules/SmoothScroll';

// IIFE for loading the application
// ==========================================================================
(function() {
    $document.on('isReady.Scroll', (event) => {
        $body.addClass('is-loaded');

        // Use case for callback handlers
        $document.triggerHandler({
            type: 'addElement.Scroll',
            selector: '.js-callback',
            callbacks: {
                enter: function() {
                    console.log('This baby is IN.')
                },
                out: function() {
                    console.log('This baby is OUT.')
                }
            }
        });
    });

    window.App = {};
    window.App.SmoothScroll = new SmoothScroll();
})();
