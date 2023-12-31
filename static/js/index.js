import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(16.5, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('globe-container').appendChild(renderer.domElement);

const starGeometry = new THREE.BufferGeometry()
const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff
})

const starVertices = []
for (let i = 0; i < 200000; i++) {
    const x = (Math.random() - 0.5) * 2000
    const y = (Math.random() - 0.5) * 2000
    const z = -Math.random() * 3000
    starVertices.push(x, y, z)
}

starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3))

const stars = new THREE.Points(starGeometry, starMaterial)
scene.add(stars)

const earthTexture = new THREE.TextureLoader().load('/static/images/earth.jpg');
earthTexture.wrapS = THREE.RepeatWrapping;
earthTexture.offset.x = -1475 / (2 * Math.PI);
const earthMaterial = new THREE.MeshPhongMaterial({
    map: earthTexture,
    color: 0xffffff,
    shininess: 50
});

const globe = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 64), earthMaterial);
globe.position.set(0, 0, 0);
scene.add(globe);

var light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(-3, 3, 4);
scene.add(light);
scene.add(new THREE.AmbientLight(0xd3d3d3, 0.25));

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const infoBox = document.getElementById('info-box');
infoBox.classList.add('hidden');

const animate = () => {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);

    if (!isEnlarged) {
        //globe.rotation.y += 0.0001;
    }
};

window.addEventListener('resize', () => {
    const {
        innerWidth,
        innerHeight
    } = window;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

let isEnlarged = false;
let isDragging = false;
const previousMousePosition = {
    x: 0,
    y: 0
};

window.addEventListener('click', onClick);




function onClick(event) {
    event.preventDefault();

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0 && intersects[0].object === globe) {
        const clickedPosition = intersects[0].point.clone();
        globe.worldToLocal(clickedPosition);

        console.log(clickedPosition)

        const latLon = convertWorldToLatLon(clickedPosition);

        if (!event.altKey && !isEnlarged) {
            setupLoading();
            if (isEnlarged) {
                removeMarkers();
            }

            addMarker(clickedPosition);

            if (!event.altKey && !isEnlarged) {
                getWeatherDetails(latLon.lat, latLon.lon)
                    .then(data => {
                        const convertedTemp = data.main.temp - 273.15;

                        document.getElementById('country-name').innerText = `${data.countryName || 'Not found'}`;
                        if (data.countryName) {
                            const favouritesBox = document.getElementById('add-to-favourites-div')
                            if (data.name) {
                                favouritesBox.style.display = 'block';
                            } else {
                                favouritesBox.style.display = 'none';
                            }

                            const flag = document.getElementById('flag');
                            flag.src = `https://flagsapi.com/${data.countryCode}/flat/64.png`;
                            flag.style.display = 'block';

                            document.getElementById('details').style.display = 'block';
                            document.getElementById('text-display').innerText = data.name ? `You are currently viewing details with regards to ${data.name}` : `No city found within the given radius`;

                            if (data.name) {
                                document.getElementById('city-container').dataset.city = `${data.name}:${data.countryCode}`
                            }

                            document.getElementById('temperature').innerHTML = `<span class="label">TEMPERATURE:</span>&nbsp;<span id="value" class="value">${convertedTemp.toFixed(2)}</span>C`;

                            document.getElementById('weather').innerHTML = `<span class="label">WEATHER:</span>&nbsp;<span class="value">${data.weather[0].description}</span>`;

                            const localTime = getLocalTimeFromOffset(data.timezone);
                            document.getElementById('time').innerHTML = `<span class="label">LOCAL TIME:</span>&nbsp;<span class="value">${localTime.toLocaleTimeString()}</span>`;
                            document.getElementById('coord-lon').innerHTML = `<span class="label">LONGITUDE:</span>&nbsp;<span class="value">${data.coord.lon}</span>`;
                            document.getElementById('coord-lat').innerHTML = `<span class="label">LATITUDE:</span>&nbsp;<span class="value">${data.coord.lat}</span>`;
                            document.getElementById('visibility').innerHTML = `<span class="label">VISIBILITY:</span>&nbsp;<span class="value">${data.visibility}</span> meters`;
                            document.getElementById('wind-speed').innerHTML = `<span class="label">WIND SPEED:</span>&nbsp;<span class="value">${data.wind.speed}</span> m/s`;
                            document.getElementById('humidity').innerHTML = `<span class="label">HUMIDITY:</span>&nbsp;<span class="value">${data.main.humidity}</span>%`;
                            document.getElementById('pressure').innerHTML = `<span class="label">PRESSURE:</span>&nbsp;<span class="value">${data.main.pressure}</span> hPa`;
                            document.getElementById('escape').style.display = 'block';
                        } else {
                            document.getElementById('text-display').innerHTML = 'The location you clicked is not a valid country, or close enough to a nearby country. Try clicking elsewhere to locate country data.';
                            document.getElementById('details').style.display = 'none';
                            document.getElementById('flag').style.display = 'none';
                        }
                    });
            }
        }

        const direction = clickedPosition.clone().sub(globe.position).normalize();
        const angleOffsetHorizontal = Math.atan2(direction.x, direction.z);
        const angleOffsetVertical = Math.asin(direction.y);

        if (!event.altKey) {
            gsap.to(globe.rotation, 1, {
                y: -angleOffsetHorizontal,
                x: angleOffsetVertical
            });
        }

        const cameraPositionZ = isEnlarged && !event.altKey ? 5 : 3.5;
        const globePositionX = isEnlarged && !event.altKey ? 0 : 0.5;

        if (!event.altKey) {
            gsap.to(camera.position, 0.75, {
                z: cameraPositionZ,
                onUpdate: updateAspect
            });
            gsap.to(globe.position, 0.75, {
                x: globePositionX
            });

            toggleInfoBox(!isEnlarged);
            fadeHowToUseMenu(isEnlarged);
            toggleSearch(isEnlarged)
            isEnlarged = !isEnlarged;
            toggleEscapePanel(isEnlarged);
            zoomLevel = 5; // Initial zoom level
            dragSpeed = 0.003;
        }
    }
}

function toggleEscapePanel(show) {
    const escapePanel = document.getElementById('escape');
    escapePanel.style.display = show ? 'block' : 'none';
}

function toggleSearch(isEnlarged) {
    const searchBar = document.getElementById('search-container');
    searchBar.style.display = isEnlarged ? 'block' : 'none'
}


let zoomLevel = 5;
let zoomSpeed = 0.1; 
let dragSpeed = 0.003;
let baseDragSpeed = 0.0025;

window.addEventListener('wheel', event => {
    if (!isEnlarged) {
        event.preventDefault();
        const delta = Math.sign(event.deltaY);

        zoomLevel += delta * zoomSpeed;
        zoomLevel = Math.min(Math.max(zoomLevel, 0.75), 10); 

        const newCameraPositionZ = isEnlarged ? 5 : zoomLevel;
        gsap.to(camera.position, 0.5, {
            z: newCameraPositionZ,
            onUpdate: updateAspect
        });

        dragSpeed = (baseDragSpeed * zoomLevel) * 0.25;
    }
});


function dragGlobe(event) {
    if (!isEnlarged) {
        if (!isDragging) {
            isDragging = true;
            previousMousePosition.x = event.clientX;
            previousMousePosition.y = event.clientY;
        } else {
            const deltaMove = {
                x: event.clientX - previousMousePosition.x,
                y: event.clientY - previousMousePosition.y
            };

            console.log(zoomLevel)
            console.log(dragSpeed)

            globe.rotation.y += deltaMove.x * dragSpeed;
            globe.rotation.x += deltaMove.y * dragSpeed;

            previousMousePosition.x = event.clientX;
            previousMousePosition.y = event.clientY;
        }
    }
}

window.addEventListener('mousedown', event => {
    if (event.altKey) {
        dragGlobe(event);
    }
});

window.addEventListener('mousemove', event => {
    if (isDragging) {
        dragGlobe(event);
    }
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

const searchButton = document.getElementById('search-button');
const citySearchInput = document.getElementById('city-search');

searchButton.addEventListener('click', () => {
    const cityName = citySearchInput.value;
    if (cityName.trim() !== '') {
        performCitySearch(cityName)
            .then(data => {
                onCitySearch(cityName, data.latitude, data.longitude)
            })
    }
});

citySearchInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        const cityName = citySearchInput.value;
        if (cityName.trim() !== '') {
            performCitySearch(cityName)
                .then(data => {
                    onCitySearch(cityName, data.latitude, data.longitude);
                });
        }
    }
});

function popupPageLoad() {
    gsap.set(globe.scale, {
        x: 0.01,
        y: 0.01,
        z: 0.01
    });
    gsap.set(globe.rotation, {
        x: 0,
        y: 0,
        z: 0
    });

    gsap.to(globe.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 2.75,
        ease: 'elastic.out(1, 0.5)'
    });
    gsap.to(globe.rotation, {
        y: Math.PI * 2,
        duration: 3,
        ease: 'power4.out'
    });
}

document.addEventListener('DOMContentLoaded', () => {
    popupPageLoad();
    fadeHowToUseMenu(!isEnlarged);
    setupFavourites();

    const bathymetryTexture = new THREE.TextureLoader().load('static/images/Topography_Earth.png');
    bathymetryTexture.wrapS = THREE.RepeatWrapping;
    bathymetryTexture.offset.x = -1475 / (2 * Math.PI);
    const bathymetryMaterial = new THREE.MeshPhongMaterial({
        map: bathymetryTexture
    });

    const topographyTexture = new THREE.TextureLoader().load('static/images/Bathymetry_Earth.png');
    topographyTexture.wrapS = THREE.RepeatWrapping;
    topographyTexture.offset.x = -1475 / (2 * Math.PI);
    const topographyMaterial = new THREE.MeshPhongMaterial({
        map: topographyTexture
    });

    const bathymetryThemeBtn = document.getElementById('bathymetry-theme-btn');
    const earthThemeBtn = document.getElementById('earth-theme-btn');
    const topographyThemeBtn = document.getElementById('topography-theme-btn');

    globe.material = bathymetryMaterial;
    globe.material = topographyMaterial;
    globe.material = earthMaterial;

    const themeButtons = [bathymetryThemeBtn, earthThemeBtn, topographyThemeBtn];

    earthThemeBtn.classList.add('active');

    function setActiveButton(button) {
        themeButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
    }

    bathymetryThemeBtn.addEventListener('click', () => {
        globe.material = bathymetryMaterial;
        setActiveButton(bathymetryThemeBtn);
    });

    earthThemeBtn.addEventListener('click', () => {
        globe.material = earthMaterial;
        setActiveButton(earthThemeBtn);
    });

    topographyThemeBtn.addEventListener('click', () => {
        globe.material = topographyMaterial;
        setActiveButton(topographyThemeBtn);
    });

    const popup = document.getElementById('popup');
    const closePopupBtn = document.getElementById('closePopup');

    function closePopup() {
        popup.style.opacity = 0;
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 500);
    }

    closePopupBtn.addEventListener('click', closePopup);

    const logoutBtn = document.getElementById('logoutBtn')
    logoutBtn.addEventListener('click', logout);
});

function logout() {
    fetch('/logout')
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;
        } else {
            console.error('Logout failed');
        }
    })
    .catch(error => {
        console.error('Error during logout:', error);
    });
}

function showPopup(text) {
    const popupText = document.getElementById("popup-text");
    popupText.innerText = text;

    const popup = document.getElementById("popup");
    popup.style.opacity = 1;
    popup.classList.remove('hidden');
}

function toggleInfoBox(show) {
    const leftValue = show ? '0' : '-100%';
    gsap.to(infoBox, 0.5, {
        left: leftValue,
        ease: 'power2.' + (show ? 'out' : 'in')
    });
    infoBox.classList.toggle('hidden', !show);

    const favouritesTab = document.getElementById('favourites-tab')
    const favouritesButton = document.getElementById('favourites-button')

    if (show) {
        favouritesTab.classList.remove('active');
    }

    favouritesButton.disabled = show ? true : false

    if (!show) {
        removeMarkers();
    }
}

function getLocalTimeFromOffset(timezoneOffsetInSeconds) {
    const utcTime = new Date();
    const localTime = new Date(utcTime.getTime() + timezoneOffsetInSeconds * 1000);

    return localTime;
}

function getWeatherDetails(lat, lon) {
    const url = `/get_weather?lat=${lat}&lon=${lon}`;
    return fetch(url)
        .then(response => response.json())
        .then(data => data)
        .catch(error => {
            console.error('Error fetching weather detials:', error);
            return null;
        });
}

function performCitySearch(cityName) {
    const url = `/search_city?city_name=${cityName}`;
    return fetch(url)
        .then(response => response.json())
        .then(data => data)
        .catch(error => {
            console.error('Error fetching city detials:', error);
            return null;
        });
}

function convertWorldToLatLon(worldPosition) {
    const radius = 0.5; 
    const latCorrectionFactor = 0; 
    const lonCorrectionFactor = -1; 

    const x = worldPosition.x;
    const y = worldPosition.y;
    const z = worldPosition.z;

    const lon = Math.atan2(x, z); 
    const hyp = Math.sqrt(x * x + z * z); 
    const lat = Math.atan2(y, hyp); 

    const latDeg = (lat * 180) / Math.PI + latCorrectionFactor; 
    let lonDeg = ((lon * 180) / Math.PI + 540) % 360 - 180 + lonCorrectionFactor; 

    return {
        lat: latDeg,
        lon: lonDeg
    };
}

function convertLatLonToWorld(latDeg, lonDeg) {
    const radius = 0.5; 
    const latCorrectionFactor = 0; 
    const lonCorrectionFactor = -1; 
    const reLatCorrectionFactor = 0.03;

    let lat = (latDeg - latCorrectionFactor) * (Math.PI / 180);
    let lon = ((lonDeg - lonCorrectionFactor + 180) % 360 - 180) * (Math.PI / 180);

    lat += reLatCorrectionFactor;

    const x = radius * Math.sin(lon) * Math.cos(lat);
    const y = radius * Math.sin(lat);
    const z = radius * Math.cos(lon) * Math.cos(lat);

    return new THREE.Vector3(x, y, z);
}


function updateAspect() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function fadeHowToUseMenu(isEnlarged) {
    const howToUseMenu = document.getElementById('how-to-use-menu');

    if (!isEnlarged) {
        gsap.to(howToUseMenu, {
            opacity: 0,
            duration: 0.5,
        });
        howToUseMenu.classList.add('hidden');
    }
    if (isEnlarged) {
        howToUseMenu.classList.remove('hidden');
        gsap.to(howToUseMenu, {
            opacity: 1,
            duration: 0.5
        });
    }
}


const markers = [];

function addMarker(position) {

    { // Create marker geometry and material
        const markerGeometry = new THREE.RingGeometry(0.015, 0.02, 32); // Adjust initial size here
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            side: THREE.DoubleSide,
            transparent: true
        });

        // Create a mesh using geometry and material for the main marker
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.copy(position);

        // Calculate the normal vector at the marker's position on the globe
        const normal = marker.position.clone().normalize();

        // Set the marker's position slightly above the surface based on the normal vector
        const offset = 0.001; // Set the offset value to position the marker above the surface
        marker.position.addScaledVector(normal, offset);

        // Look at the globe's position to orient the marker
        marker.lookAt(globe.position);

        // Orient the marker based on the globe's position
        const markerNormal = marker.position.clone().normalize();
        marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), markerNormal);

        // Set initial scale of the marker
        marker.scale.set(0.01, 0.01, 0.01);

        // Add a white dot to the center of the marker
        const dotGeometry = new THREE.CircleGeometry(0.005, 32);
        const dotMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00
        });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        marker.add(dot); // Add the dot as a child of the marker
        dot.position.set(0, 0, 0.001); // Position the dot slightly above the marker's surface

        // Add the marker to the globe and store in markers array
        globe.add(marker);
        markers.push(marker);

        // Function to perform the streaming animation
        function animateStream() {
            gsap.to(marker.scale, {
                x: 1, // Scale up the marker (can adjust the value for desired effect)
                y: 1,
                z: 1,
                duration: 1, // Set the duration for scaling up
                ease: 'power2.out',
                onComplete: () => {
                    gsap.to(marker.material, {
                        opacity: 0, // Fade out the opacity
                        duration: 0.5, // Set the duration for opacity fade
                        onComplete: () => {
                            resetAnimation(); // Reset animation for the marker
                        }
                    });
                }
            });
        }

        // Function to reset the animation for the marker
        function resetAnimation() {
            gsap.to(marker.scale, {
                x: 0.01, // Scale down the marker back to the original smaller size
                y: 0.01,
                z: 0.01,
                duration: 0, // Instant scale change
                onComplete: () => {
                    marker.material.opacity = 1; // Reset opacity
                    animateStream(); // Restart the animation recursively
                }
            });
        }

        // Start the streaming animation
        animateStream();

    }
}


function removeMarkers() {
    markers.forEach(marker => {
        gsap.to(marker.scale, {
            x: 0.01,
            y: 0.01,
            z: 0.01,
            duration: 0.5,
            ease: 'back.in(1.7)',
            onComplete: () => {
                globe.remove(marker);
            }
        });
    });
    markers.length = 0;
}


function setupLoading() {
    document.getElementById('country-name').innerHTML = "Loading Data..."
    document.getElementById('text-display').innerHTML = 'Hang tight while we work on fetching your data';
    document.getElementById('details').style.display = 'none';
    document.getElementById('flag').style.display = 'none';
}

async function onCitySearch(entry, lat, lon) {
    if (isEnlarged) {
        isEnlarged = !isEnlarged;
    }

    entry = entry.split(", ")[1] ? entry.split(", ")[0] : entry

    if (!isEnlarged) {
        setupLoading();
        if (isEnlarged) {
            removeMarkers();
        }

        if ((lat && lon)) {
            const worldCoordinates = convertLatLonToWorld(lat, lon);
    
            const direction = worldCoordinates.clone().sub(globe.position).normalize();
            const angleOffsetHorizontal = Math.atan2(direction.x, direction.z);
            const angleOffsetVertical = Math.asin(direction.y);
    
            gsap.to(globe.rotation, 1, {
                y: -angleOffsetHorizontal,
                x: angleOffsetVertical
            });

            addMarker(worldCoordinates);
        }

        if (!isEnlarged) {
            try {
                const data = await getWeatherDetails(lat, lon);

                document.getElementById('country-name').innerText = `${data.countryName || 'Not found'}`;
                if (data.countryName) {
                    const convertedTemp = data.main.temp - 273.15;
                    const flag = document.getElementById('flag');
                    flag.src = `https://flagsapi.com/${data.countryCode}/flat/64.png`;
                    flag.style.display = 'block';

                    document.getElementById('details').style.display = 'block';
                    document.getElementById('text-display').innerText = data.name ? `You are currently viewing details with regards to ${data.name}` : `No city found within the given radius`;
                    if (data.name) {
                        document.getElementById('city-container').dataset.city = `${entry}:${data.countryCode}`
                    }
                    document.getElementById('temperature').innerHTML = `<span class="label">TEMPERATURE:</span>&nbsp;<span id="value" class="value">${convertedTemp.toFixed(2)}</span>C`;
                    document.getElementById('weather').innerHTML = `<span class="label">WEATHER:</span>&nbsp;<span class="value">${data.weather[0].description}</span>`;

                    const localTime = getLocalTimeFromOffset(data.timezone);
                    document.getElementById('time').innerHTML = `<span class="label">LOCAL TIME:</span>&nbsp;<span class="value">${localTime.toLocaleTimeString()}</span>`;
                    document.getElementById('coord-lon').innerHTML = `<span class="label">LONGITUDE:</span>&nbsp;<span class="value">${data.coord.lon}</span>`;
                    document.getElementById('coord-lat').innerHTML = `<span class="label">LATITUDE:</span>&nbsp;<span class="value">${data.coord.lat}</span>`;
                    document.getElementById('visibility').innerHTML = `<span class="label">VISIBILITY:</span>&nbsp;<span class="value">${data.visibility}</span> meters`;
                    document.getElementById('wind-speed').innerHTML = `<span class="label">WIND SPEED:</span>&nbsp;<span class="value">${data.wind.speed}</span> m/s`;
                    document.getElementById('humidity').innerHTML = `<span class="label">HUMIDITY:</span>&nbsp;<span class="value">${data.main.humidity}</span>%`;
                    document.getElementById('pressure').innerHTML = `<span class="label">PRESSURE:</span>&nbsp;<span class="value">${data.main.pressure}</span> hPa`;
                    document.getElementById('escape').style.display = 'block';

                    const cameraPositionZ = isEnlarged ? 5 : 3.5;
                    const globePositionX = isEnlarged ? 0 : 0.5;

                    gsap.to(camera.position, 0.75, {
                        z: cameraPositionZ,
                        onUpdate: updateAspect
                    });
                    gsap.to(globe.position, 0.75, {
                        x: globePositionX
                    });

                    fadeHowToUseMenu(isEnlarged);
                    toggleSearch(isEnlarged)
                    toggleEscapePanel(isEnlarged);
                } else {
                    document.getElementById('text-display').innerHTML = 'The location you clicked is not a valid country, or close enough to a nearby country. Try clicking elsewhere to locate country data.';
                    document.getElementById('details').style.display = 'none';
                    document.getElementById('flag').style.display = 'none';
                }
            } catch (error) {
                console.error('Error fetching weather details:', error);
            }
        }

        toggleInfoBox(!isEnlarged);
        isEnlarged = !isEnlarged;
    }
}

async function removeFavourite(username, city) {
    try {
        city = city.split(", ").join(":")
        let cityName = city.split(":")[0]

        const response = await fetch(`/remove_favourites?username=${username}&city_name=${city}`);
        const data = await response.json();

        if (data == true) {
            const container = document.getElementById(`div-${city.trim()}`)
            container.remove()
            showPopup(`${cityName} has been successfully removed from your favourites`)
        } else {
            console.error("Error removing favourite");
        }
    } catch (error) {
        console.error("Error removing favourite:", error);
    }
}

function gatherFavouritesInfo() {
    const city = document.getElementById('city-container').dataset.city;
    const usernameContainer = document.getElementById("username-container");
    const username = usernameContainer.dataset.username;

    if (city.trim() !== '') {
        addToFavourites(username, city);
    } else {
        alert('Please enter a city name before adding to favorites.');
    }
}

async function addToFavourites(username, city) {
    const url = `/add_to_favourites?username=${username}&city_name=${city}`;

    let cityName = city.split(":")[0]

    try {
        const response = await fetch(url, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            showPopup(`${cityName} has been successfully added to your favourites`)
        } else {
            alert(`Failed to add ${cityName} to favorites. Please try again.`);
        }
    } catch (error) {
        console.error('Error adding to favorites:', error);
    }
}
const redSlider = document.getElementById('red-slider');
const greenSlider = document.getElementById('green-slider');
const blueSlider = document.getElementById('blue-slider');
const textElements = document.querySelectorAll('p:not(.disclude), h2:not(.disclude), h3, h4, h5, h6, .label, .value, li');

function updateTextColor() {
    const redValue = redSlider.value;
    const greenValue = greenSlider.value;
    const blueValue = blueSlider.value;

    textElements.forEach(element => {
        element.style.color = `rgb(${redValue}, ${greenValue}, ${blueValue})`;
    });
}

redSlider.addEventListener('input', updateTextColor);
greenSlider.addEventListener('input', updateTextColor);
blueSlider.addEventListener('input', updateTextColor);

const favouriteACity = document.getElementById('add-to-favourites-info')
favouriteACity.addEventListener('click', gatherFavouritesInfo);

const settingsTab = document.getElementById('settings-tab');
const sliderBarsContainer = document.getElementById('slider-bars-container');

settingsTab.addEventListener('click', () => {
    settingsTab.classList.add('spin');
    sliderBarsContainer.classList.toggle('show');
    setTimeout(() => {
        settingsTab.classList.remove('spin');
    }, 1000);

});

const fontSizeInput = document.getElementById('fontSizeInput');

fontSizeInput.addEventListener('input', function() {
    const fontSize = this.value + 'px';
    textElements.forEach(element => {
        element.style.fontSize = fontSize;
    });
});

function setupFavourites() {
    const favouritesButton = document.getElementById("favourites-button");
    const favouritesTab = document.getElementById("favourites-tab");
    const favouritesList = document.getElementById("favourite-cities-list");

    const usernameContainer = document.getElementById("username-container");
    const username = usernameContainer.dataset.username;

    if (favouritesButton) {
        favouritesButton.addEventListener("click", async function() {
            try {
                const fadeDuration = 0.5;

                favouritesTab.style.opacity = '0';
                favouritesTab.style.left = '-100%';

                gsap.to(favouritesTab, fadeDuration, {
                    opacity: 1,
                    left: '0',
                    ease: 'power2.out',
                });

                favouritesTab.classList.toggle("active");

                const response = await fetch(`/get_user_favourites?username=${username}`);
                const data = await response.json();

                favouritesList.innerHTML = "";

                let cityArray;
                if (data[0]) {
                    cityArray = data[0].split(",")
                }

                const cityContainer = document.createElement("div");
                const buttonContainer = document.createElement("div");
                buttonContainer.className = "btnContainer"

                if (cityArray && cityArray.length > 0) {
                    cityArray.forEach(function(city) {
                        if (city == "") return;

                        const listItem = document.createElement("li");
                        const btnDiv = document.createElement("div")
                        const searchButton = document.createElement("button")
                        const removeButton = document.createElement("button")

                        btnDiv.id = `div-${city.trim()}`

                        listItem.id = "favList"
                        searchButton.className = "favBtn search"
                        searchButton.textContent = "Search"
                        removeButton.className = "favBtn remove";
                        removeButton.textContent = "Remove"

                        city = city.split(":").join(", ")
                        let cityName = city.split(", ")[0]
                        
                        const truncatedCity = cityName.length > 13 ? cityName.substring(0, 13) + "..." : cityName;

                        listItem.textContent = truncatedCity;
                        cityContainer.appendChild(listItem)
                        buttonContainer.appendChild(searchButton)
                        buttonContainer.appendChild(removeButton)

                        btnDiv.appendChild(listItem)
                        btnDiv.appendChild(searchButton)
                        btnDiv.appendChild(removeButton)

                        buttonContainer.appendChild(btnDiv)
                        favouritesList.appendChild(cityContainer)
                        favouritesList.appendChild(buttonContainer)

                        searchButton.addEventListener("click", function() {
                            performCitySearch(city)
                                .then(data => {
                                    onCitySearch(cityName, data.latitude, data.longitude)
                                    favouritesTab.classList.toggle("active");
                                })
                        });

                        removeButton.addEventListener("click", function() {
                            removeFavourite(username, city);
                        });
                    });

                    favouritesTab.classList.remove("hidden");
                } else {
                    favouritesList.innerHTML = "<li>No favourites found</li>";

                    favouritesTab.classList.remove("hidden");
                }
            } catch (error) {
                console.error("Error fetching favourites:", error);
            }
        });
    } else {
        console.error("Favourites button not found");
    }
}

animate();