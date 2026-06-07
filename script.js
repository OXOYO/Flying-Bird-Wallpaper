// Carousel functionality
let currentIndex = 0;
const slides = document.querySelectorAll('.carousel-item');
const totalSlides = slides.length;
const carouselInner = document.querySelector('.carousel-inner');
const nextBtn = document.querySelector('.carousel-control.next');
const prevBtn = document.querySelector('.carousel-control.prev');
let autoplayTimer = null;

function updateCarousel() {
    if (!carouselInner || totalSlides === 0) return;
    carouselInner.style.transform = `translateX(-${currentIndex * 100}%)`;
}

function nextSlide() {
    if (totalSlides === 0) return;
    currentIndex = (currentIndex + 1) % totalSlides;
    updateCarousel();
}

function prevSlide() {
    if (totalSlides === 0) return;
    currentIndex = (currentIndex - 1 + totalSlides) % totalSlides;
    updateCarousel();
}

function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(nextSlide, 5000);
}

function stopAutoplay() {
    if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
    }
}

if (totalSlides > 0) {
    updateCarousel();
    startAutoplay();

    nextBtn?.addEventListener('click', () => {
        nextSlide();
        startAutoplay();
    });
    prevBtn?.addEventListener('click', () => {
        prevSlide();
        startAutoplay();
    });

    const carousel = document.querySelector('.carousel');
    carousel?.addEventListener('mouseenter', stopAutoplay);
    carousel?.addEventListener('mouseleave', startAutoplay);
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || href === '#') return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    });
});
