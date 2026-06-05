/* =========================================================
   NaturEspaces — Interactions front (vanilla JS)
   ========================================================= */

(function () {
    'use strict';

    var prefersReducedMotion = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isCoarsePointer = window.matchMedia
        && window.matchMedia('(pointer: coarse)').matches;
    var isMobile = window.matchMedia
        && window.matchMedia('(max-width: 768px)').matches;

    /* ---------------------------------------------------------
       Reveal au scroll
       --------------------------------------------------------- */
    function initReveal() {
        var elements = document.querySelectorAll('.reveal');
        if (!elements.length) return;

        if (!('IntersectionObserver' in window) || prefersReducedMotion) {
            elements.forEach(function (el) { el.classList.add('reveal-visible'); });
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        elements.forEach(function (el) { observer.observe(el); });
    }

    /* ---------------------------------------------------------
       Compteurs animés
       --------------------------------------------------------- */
    function animateCounter(el) {
        var target = parseInt(el.getAttribute('data-counter-target'), 10);
        var suffix = el.getAttribute('data-counter-suffix') || '';
        if (isNaN(target)) return;

        if (prefersReducedMotion) {
            el.textContent = target + suffix;
            return;
        }

        var duration = 1500;
        var startTime = null;

        function step(ts) {
            if (!startTime) startTime = ts;
            var elapsed = ts - startTime;
            var progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            var eased = 1 - Math.pow(1 - progress, 3);
            var value = Math.round(eased * target);
            el.textContent = value + suffix;
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = target + suffix;
            }
        }
        requestAnimationFrame(step);
    }

    function initCounters() {
        var counters = document.querySelectorAll('.counter');
        if (!counters.length) return;

        if (!('IntersectionObserver' in window)) {
            counters.forEach(animateCounter);
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.4 });

        counters.forEach(function (el) {
            el.textContent = '0' + (el.getAttribute('data-counter-suffix') || '');
            observer.observe(el);
        });
    }

    /* ---------------------------------------------------------
       Parallaxe hero
       --------------------------------------------------------- */
    function initHeroParallax() {
        if (prefersReducedMotion || isMobile) return;

        var hero = document.querySelector('.hero-shell');
        var heroImg = document.querySelector('.hero-img');
        if (!hero || !heroImg) return;

        var ticking = false;
        function onScroll() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                var rect = hero.getBoundingClientRect();
                if (rect.bottom > 0 && rect.top < window.innerHeight) {
                    var translate = Math.max(0, -rect.top) * 0.3;
                    heroImg.style.setProperty('--hero-translate', translate + 'px');
                }
                ticking = false;
            });
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ---------------------------------------------------------
       Carte IDF — stagger entrée + tooltip + accessibilité
       --------------------------------------------------------- */
    function initIdfMap() {
        var map = document.querySelector('.idf-map');
        var wrapper = document.querySelector('.idf-map-wrapper');
        var tooltip = document.getElementById('idf-tooltip');
        if (!map || !wrapper || !tooltip) return;

        var allDepts = Array.from(map.querySelectorAll('.idf-dept'));

        // Ordre d'apparition : 75 d'abord (cœur), puis ondes concentriques.
        var revealOrder = ['75', '92', '93', '94', '78', '77', '91', '95'];

        function revealMap() {
            if (prefersReducedMotion) {
                allDepts.forEach(function (d) { d.classList.add('idf-revealed'); });
                return;
            }
            revealOrder.forEach(function (code, idx) {
                var path = map.querySelector('.idf-dept[data-dept="' + code + '"]');
                if (path) {
                    setTimeout(function () { path.classList.add('idf-revealed'); }, idx * 80);
                }
            });
        }

        if (!('IntersectionObserver' in window)) {
            revealMap();
        } else {
            var revealObs = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        revealMap();
                        revealObs.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.25 });
            revealObs.observe(map);
        }

        /* Tooltip */
        function showTooltip(path, sourceEvent) {
            var sites    = path.getAttribute('data-sites');
            var name     = path.getAttribute('data-name');
            var code     = path.getAttribute('data-dept');
            var clients  = path.getAttribute('data-clients') || '';

            tooltip.innerHTML =
                '<div class="idf-tooltip-name">' + name + ' — ' + code + '</div>' +
                '<div class="idf-tooltip-sites">' +
                    sites + ' site' + (parseInt(sites, 10) > 1 ? 's' : '') + " d'intervention" +
                '</div>' +
                '<div class="idf-tooltip-clients">' + clients + '</div>';

            // Positionnement : au-dessus du centre du path (bbox)
            var wrapperRect = wrapper.getBoundingClientRect();
            var pathRect = path.getBoundingClientRect();
            var cx = pathRect.left + pathRect.width / 2 - wrapperRect.left;
            var cy = pathRect.top - wrapperRect.top;

            tooltip.style.left = cx + 'px';
            tooltip.style.top  = cy + 'px';

            tooltip.classList.add('is-visible');
            tooltip.setAttribute('aria-hidden', 'false');
        }

        function hideTooltip() {
            tooltip.classList.remove('is-visible');
            tooltip.setAttribute('aria-hidden', 'true');
        }

        var activeDepts = map.querySelectorAll('.idf-active');
        activeDepts.forEach(function (path) {
            // Souris
            path.addEventListener('mouseenter', function (e) { showTooltip(path, e); });
            path.addEventListener('mouseleave', hideTooltip);
            // Clavier / focus
            path.addEventListener('focus',  function (e) { showTooltip(path, e); });
            path.addEventListener('blur',   hideTooltip);
            // Tap mobile : on toggle
            path.addEventListener('click', function (e) {
                e.preventDefault();
                if (tooltip.classList.contains('is-visible') &&
                    tooltip.getAttribute('data-active-dept') === path.getAttribute('data-dept')) {
                    hideTooltip();
                    tooltip.removeAttribute('data-active-dept');
                } else {
                    showTooltip(path, e);
                    tooltip.setAttribute('data-active-dept', path.getAttribute('data-dept'));
                }
            });
            // Clavier ENTER
            path.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    showTooltip(path, e);
                }
                if (e.key === 'Escape') {
                    hideTooltip();
                    path.blur();
                }
            });
        });

        // Tap outside to dismiss (mobile)
        document.addEventListener('click', function (e) {
            if (!wrapper.contains(e.target)) {
                hideTooltip();
                tooltip.removeAttribute('data-active-dept');
            }
        });
    }

    /* ---------------------------------------------------------
       Apparition en cascade (stagger) — frise, organigramme, grilles
       --------------------------------------------------------- */
    function initStagger() {
        var groups = document.querySelectorAll('[data-stagger]');
        if (!groups.length) return;

        if (!('IntersectionObserver' in window) || prefersReducedMotion) {
            groups.forEach(function (g) { g.classList.add('is-visible'); });
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });

        groups.forEach(function (g) { observer.observe(g); });
    }

    /* ---------------------------------------------------------
       Barre de progression de lecture + ombre header (pages légales)
       --------------------------------------------------------- */
    function initReadingProgress() {
        var bar = document.getElementById('reading-progress');
        if (!bar) return;

        var ticking = false;

        function update() {
            var doc = document.documentElement;
            var scrollTop = doc.scrollTop || document.body.scrollTop;
            var height = doc.scrollHeight - doc.clientHeight;
            var pct = height > 0 ? (scrollTop / height) * 100 : 0;
            bar.style.width = pct + '%';
            ticking = false;
        }

        function onScroll() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(update);
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        update();
    }

    /* ---------------------------------------------------------
       Sommaire sticky — surbrillance au scroll (IntersectionObserver)
       --------------------------------------------------------- */
    function initLegalToc() {
        var toc = document.querySelector('.legal-toc');
        if (!toc) return;

        var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
        if (!links.length || !('IntersectionObserver' in window)) return;

        var map = {};
        var sections = [];
        links.forEach(function (link) {
            var id = link.getAttribute('href').slice(1);
            var section = document.getElementById(id);
            if (section) {
                map[id] = link;
                sections.push(section);
            }
        });

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    links.forEach(function (l) {
                        l.classList.remove('active');
                        l.removeAttribute('aria-current');
                    });
                    var active = map[entry.target.id];
                    if (active) {
                        active.classList.add('active');
                        active.setAttribute('aria-current', 'true');
                    }
                }
            });
        }, { rootMargin: '-100px 0px -65% 0px', threshold: 0 });

        sections.forEach(function (s) { observer.observe(s); });
    }

    /* ---------------------------------------------------------
       Menu burger mobile (pages légales)
       --------------------------------------------------------- */
    function initMobileNav() {
        var burger = document.querySelector('.burger');
        var nav = document.getElementById('legal-mobile-nav');
        if (!burger || !nav) return;

        var icon = burger.querySelector('.material-symbols-outlined');

        function close() {
            nav.setAttribute('hidden', '');
            burger.setAttribute('aria-expanded', 'false');
            if (icon) icon.textContent = 'menu';
        }
        function open() {
            nav.removeAttribute('hidden');
            burger.setAttribute('aria-expanded', 'true');
            if (icon) icon.textContent = 'close';
        }

        burger.addEventListener('click', function () {
            if (nav.hasAttribute('hidden')) { open(); } else { close(); }
        });
        nav.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', close);
        });
    }

    /* ---------------------------------------------------------
       Ombre légère du header sticky au scroll (légal + accueil)
       --------------------------------------------------------- */
    function initHeaderShadow() {
        var header = document.querySelector('.legal-header');
        if (!header) return;

        var ticking = false;
        function update() {
            var top = document.documentElement.scrollTop || document.body.scrollTop;
            header.classList.toggle('scrolled', top > 4);
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(update);
        }, { passive: true });
        update();
    }

    /* ---------------------------------------------------------
       Scrollspy du header d'accueil — surbrillance du lien actif
       (même logique IntersectionObserver que le sommaire légal)
       --------------------------------------------------------- */
    function initHeaderNavSpy() {
        var nav = document.querySelector('.site-nav');
        if (!nav || !('IntersectionObserver' in window)) return;

        var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
        if (!links.length) return;

        var map = {};
        var sections = [];
        links.forEach(function (link) {
            var id = link.getAttribute('href').slice(1);
            var section = id ? document.getElementById(id) : null;
            if (section) {
                map[id] = link;
                sections.push(section);
            }
        });

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    links.forEach(function (l) {
                        l.classList.remove('active');
                        l.removeAttribute('aria-current');
                    });
                    var active = map[entry.target.id];
                    if (active) {
                        active.classList.add('active');
                        active.setAttribute('aria-current', 'true');
                    }
                }
            });
        }, { rootMargin: '-90px 0px -65% 0px', threshold: 0 });

        sections.forEach(function (s) { observer.observe(s); });
    }

    /* ---------------------------------------------------------
       Init
       --------------------------------------------------------- */
    function init() {
        initReveal();
        initCounters();
        initHeroParallax();
        initIdfMap();
        initStagger();
        initReadingProgress();
        initLegalToc();
        initMobileNav();
        initHeaderShadow();
        initHeaderNavSpy();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
