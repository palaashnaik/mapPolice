const centroids = [
    { name: 'Vasco da Gama', longitude: 73.8113, latitude: 15.3927 },
    { name: 'Ponda', longitude: 73.9668, latitude: 15.4027 },
    { name: 'Bicholim', longitude: 73.9087, latitude: 15.5857 },
    { name: 'Curchorem', longitude: 74.1109, latitude: 15.2644 },
    { name: 'Valpoi', longitude: 74.1367, latitude: 15.5321 },
    { name: 'Canacona', longitude: 74.0593, latitude: 14.9959 },
    { name: 'Pernem', longitude: 73.7951, latitude: 15.7217 },
    { name: 'Sanguem', longitude: 74.1510, latitude: 15.2292 },
    { name: 'Quepem', longitude: 74.0777, latitude: 15.2126 },
    { name: 'Dharbandora', longitude: 74.2070, latitude: 15.4226 }
];

const regionColors = {
    'North West': '#ff6b6b',
    'North East': '#4ecdc4',
    'South West': '#45aaf2',
    'South East': '#fed330'
};

let map;
let data = [];

function loadCSVData() {
    return new Promise((resolve, reject) => {
        Papa.parse('data.csv', {
            download: true,
            header: true,
            complete: function(results) {
                resolve(results.data);
            },
            error: function(error) {
                reject(error);
            }
        });
    });
}

function initializeMap() {
    map = L.map('map').setView([15.4, 73.8], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function distance(point1, point2) {
    const dx = point1.longitude - point2.longitude;
    const dy = point1.latitude - point2.latitude;
    return Math.sqrt(dx * dx + dy * dy);
}

function kMeansClustering(data, centroids) {
    return data.map(point => {
        let minDistance = Infinity;
        let cluster = null;
        centroids.forEach(centroid => {
            const d = distance(point, centroid);
            if (d < minDistance) {
                minDistance = d;
                cluster = centroid;
            }
        });
        return { ...point, cluster };
    });
}

function categorizeRegion(longitude, latitude) {
    const centerLong = 73.99;
    const centerLat = 15.35;
    if (longitude < centerLong && latitude > centerLat) return 'North West';
    if (longitude >= centerLong && latitude > centerLat) return 'North East';
    if (longitude < centerLong && latitude <= centerLat) return 'South West';
    return 'South East';
}

function visualizeClusters(clusteredData) {
    const groupedData = {};
    clusteredData.forEach(point => {
        if (point.cluster && point.cluster.name) {
            if (!groupedData[point.cluster.name]) {
                groupedData[point.cluster.name] = [];
            }
            groupedData[point.cluster.name].push(point);
        } else {
            console.error('Invalid cluster data:', point);
        }
    });

    Object.entries(groupedData).forEach(([clusterName, points]) => {
        if (points.length === 0) {
            console.warn(`No points for cluster: ${clusterName}`);
            return;
        }

        const region = categorizeRegion(points[0].longitude, points[0].latitude);
        const color = regionColors[region];

        const clusterGroup = L.featureGroup();
        points.forEach(point => {
            L.circleMarker([point.latitude, point.longitude], {
                radius: 8,
                fillColor: color,
                color: '#000',
                weight: 1,
                opacity: 1,
                fillOpacity: 1
            }).bindPopup(`Vehicle: ${point.vehicleNumber}<br>Violation: ${point.violations}`).addTo(clusterGroup);
        });

        const centroid = centroids.find(c => c.name === clusterName);
        if (centroid) {
            L.marker([centroid.latitude, centroid.longitude], {
                icon: L.divIcon({
                    className: 'cluster-icon',
                    html: `<div style="background-color: ${color}; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 16px; border: 2px solid #000;">${points.length}</div>`
                })
            }).bindPopup(`<strong>${clusterName}</strong><br>Region: ${region}<br>Violations: ${points.length}`).addTo(clusterGroup);
        } else {
            console.error(`Centroid not found for cluster: ${clusterName}`);
        }

        clusterGroup.addTo(map);
    });

    addLegend();
}

function addLegend() {
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'legend');
        let content = '<h4>Regions</h4>';
        Object.entries(regionColors).forEach(([region, color]) => {
            content += `<div><span class="color-box" style="background-color: ${color};"></span>${region}</div>`;
        });
        div.innerHTML = content;
        return div;
    };
    legend.addTo(map);
}

function addHeatmapLayer(data) {
    const heatData = data.map(point => [point.latitude, point.longitude, 1]);
    const heat = L.heatLayer(heatData, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        max: 1,
        gradient: {0.4: 'blue', 0.65: 'lime', 1: 'red'}
    }).addTo(map);

    const baseLayers = {
        "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        })
    };

    const overlays = {
        "Heatmap": heat,
        "Clusters": L.layerGroup(map._layers)
    };

    L.control.layers(baseLayers, overlays).addTo(map);
}

async function init() {
    try {
        data = await loadCSVData();
        data = data.map(item => ({
            ...item,
            latitude: parseFloat(item.latitude),
            longitude: parseFloat(item.longitude)
        }));
        initializeMap();
        const clusteredData = kMeansClustering(data, centroids);
        visualizeClusters(clusteredData);
        addHeatmapLayer(data);
    } catch (error) {
        console.error('Error initializing application:', error);
    }
}

init();