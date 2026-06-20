/* MiLife Prototype Engine */

let rawData = { data_dump: {}, connections: [] };
let treeData = null;
let svg, g, zoom, treemap;
let spotlightNodeId = null;

// 1. Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

// 2. Data Pipeline
async function loadData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error("Could not load data.json");
        rawData = await response.json();
        
        buildTree();
        renderTree();
        
        document.getElementById('loadingOverlay').style.display = 'none';
    } catch (err) {
        console.error("Data Load Error:", err);
        document.getElementById('loadingOverlay').textContent = "⚠️ Error loading data.json";
    }
}

const CONFIG = {
    colors: { 
        green: '#48bb78', 
        pink: '#f687b3', 
        yellow: '#ecc94b', 
        red: '#f56565',
        missing: '#e2e8f0' // Light gray block color for missing children
    },
    status: {
        SAFE: { border: '#c5a059', color: '#c5a059' },
        ELAPSED: { border: '#ff4757', color: '#ff4757' },
        ABOUT_TO_ELAPSE: { border: '#ffa502', color: '#ffa502' }
    }
};

// 3. Position Parser Helper
function parsePosition(pos) {
    const p = (pos || '').toLowerCase().trim();
    if (p.startsWith('left')) {
        const num = p.replace('left', '').trim();
        return { side: 'left', num: num };
    }
    if (p.startsWith('right')) {
        const num = p.replace('right', '').trim();
        return { side: 'right', num: num };
    }
    return { side: 'unknown', num: '' };
}

// 4. Tree Logic (D3.js)
function buildTree() {
    const connections = rawData.connections || [];
    const data_dump = rawData.data_dump || {};

    if (!connections.length) return;
    
    const mcData = generateMissingChildren(connections);
    const fullConnections = [...connections, ...mcData];

    // Build node map keyed by userId
    const nodesMap = {};
    fullConnections.forEach(conn => {
        const details = conn.isMC ? {} : (data_dump[conn.userId] || {});
        nodesMap[conn.userId] = {
            userId: conn.userId,
            sponsorId: conn.sponsorId,
            position: conn.branch || '',
            isMC: conn.isMC || false,
            codeName: details.codeName || (conn.isMC ? '' : conn.userId),
            color: details.color || 'green',
            status: details.status || 'safe',
            children: []
        };
    });

    // Establish parent-child links
    treeData = null;
    
    // Find primary root (the first connection with no sponsorId)
    const primaryRootConn = connections.find(conn => !conn.sponsorId);
    const primaryRootId = primaryRootConn ? primaryRootConn.userId : connections[0].userId;

    fullConnections.forEach(conn => {
        const node = nodesMap[conn.userId];
        const sponsorId = conn.sponsorId;
        if (sponsorId && nodesMap[sponsorId]) {
            nodesMap[sponsorId].children.push(node);
        }
    });

    treeData = nodesMap[primaryRootId];

    sortHierarchy(treeData);
}

function generateMissingChildren(connections) {
    const sponsorGroups = {};
    connections.forEach(conn => {
        const sponsorId = conn.sponsorId;
        if (!sponsorId) return;
        if (!sponsorGroups[sponsorId]) {
            sponsorGroups[sponsorId] = [];
        }
        sponsorGroups[sponsorId].push(conn);
    });

    const mcNodes = [];
    Object.keys(sponsorGroups).forEach(sponsorId => {
        const group = sponsorGroups[sponsorId];
        
        // Complexity occurs if:
        // 1. There are more than 2 children, OR
        // 2. Any child's position is complex (contains numbers or is not strictly simple "left" or "right")
        let isComplex = group.length > 2;
        let hasLeft = false;
        let hasRight = false;

        group.forEach(conn => {
            const rawPos = conn.branch || '';
            const posInfo = parsePosition(rawPos);
            
            if (posInfo.side === 'unknown') {
                isComplex = true;
            } else if (posInfo.num !== '') {
                isComplex = true;
            }
            
            if (posInfo.side === 'left') hasLeft = true;
            if (posInfo.side === 'right') hasRight = true;
        });

        if (!isComplex) {
            // Safe simple binary: check if one side is missing
            if (hasLeft && !hasRight) {
                mcNodes.push({
                    userId: `MC-R-${sponsorId}`,
                    sponsorId: sponsorId,
                    branch: 'right',
                    isMC: true
                });
            }
            if (!hasLeft && hasRight) {
                mcNodes.push({
                    userId: `MC-L-${sponsorId}`,
                    sponsorId: sponsorId,
                    branch: 'left',
                    isMC: true
                });
            }
        }
    });
    return mcNodes;
}

function sortHierarchy(node) {
    if (node && node.children) {
        node.children.sort((a, b) => {
            const posA = parsePosition(a.position);
            const posB = parsePosition(b.position);
            
            // First, sort by side: left comes before right
            if (posA.side === 'left' && posB.side === 'right') return -1;
            if (posA.side === 'right' && posB.side === 'left') return 1;
            
            // If on the same side, sort by slot number
            if (posA.side === posB.side) {
                const numA = posA.num;
                const numB = posB.num;
                if (numA === numB) return 0;
                if (numA === '') return -1;
                if (numB === '') return 1;
                
                const valA = parseInt(numA, 10);
                const valB = parseInt(numB, 10);
                if (!isNaN(valA) && !isNaN(valB)) {
                    return valA - valB;
                }
                return numA.localeCompare(numB);
            }
            return 0;
        });
        node.children.forEach(sortHierarchy);
    }
}

function renderTree() {
    if (!treeData) return;

    const container = document.querySelector('.tree-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg = d3.select("#treeSvg").attr("width", width).attr("height", height);
    svg.selectAll("*").remove();

    // Background click resets spotlight
    svg.on("click", (e) => {
        if (e.target.tagName === 'svg' || e.target.id === 'treeSvg') {
            spotlightNodeId = null;
            applySpotlight(null);
        }
    });

    g = svg.append("g");

    zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    treemap = d3.tree().nodeSize([240, 280]); 
    const root = d3.hierarchy(treeData);
    const nodes = treemap(root);

    // Update Intelligence Legend Stats
    updateTreeStats(root);

    // Links (Blue for Left, Purple for Right)
    g.selectAll(".link")
        .data(root.links())
        .enter().append("path")
        .attr("class", "link")
        .attr("stroke", d => {
            const posInfo = parsePosition(d.target.data.position);
            return posInfo.side === 'left' ? "#4facfe" : "#a06cfc";
        })
        .attr("stroke-dasharray", d => d.target.data.isMC ? "5,5" : "0")
        .attr("d", d3.linkVertical().x(d => d.x).y(d => d.y));

    // Capsule Nodes
    const nodeEnter = g.selectAll(".node")
        .data(root.descendants())
        .enter().append("g")
        .attr("class", d => `node ${d.data.status}-node`)
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .on("click", (e, d) => {
            e.stopPropagation();
            toggleNode(d);
        });

    // Highlight Halo (Hidden by default, shown when searched)
    nodeEnter.append("circle")
        .attr("class", "search-halo")
        .attr("cx", 0).attr("cy", 0)
        .attr("r", 110)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", "2")
        .style("opacity", 0)
        .style("pointer-events", "none");

    // The Capsule (Rectangle)
    nodeEnter.append("rect")
        .attr("class", "node-rect")
        .attr("x", -85).attr("y", -35)
        .attr("width", 170).attr("height", 70)
        .attr("fill", d => {
            if (d.data.isMC) return CONFIG.colors.missing;
            return CONFIG.colors[d.data.color?.toLowerCase()] || '#2d3436';
        })
        .attr("stroke", d => {
            if (d.data.isMC) return "transparent";
            if (d.data.status === 'safe') return "#006400";
            if (d.data.status === 'not_safe') return "#ffa502";
            if (d.data.status === 'dead') return "#ff4757";
            return "#c5a059";
        });

    // Name Label (Header)
    nodeEnter.append("text")
        .attr("class", "name-label")
        .attr("dy", "-5")
        .attr("text-anchor", "middle")
        .text(d => d.data.isMC ? "" : d.data.codeName);

    // ID Label (Subtitle)
    nodeEnter.append("text")
        .attr("class", "id-label")
        .attr("dy", "15")
        .attr("text-anchor", "middle")
        .text(d => d.data.isMC ? "" : `ID: ${d.data.userId || 'N/A'}`);

    // Status Symbols
    nodeEnter.each(function(d) {
        if (!d.data.isMC) {
            const node = d3.select(this);
            if (d.data.status === 'safe') {
                node.append("text").attr("class", "status-symbol").attr("x", 65).attr("y", -18).style("fill", "#fff").text("✓");
            } else if (d.data.status === 'not_safe') {
                node.append("text").attr("class", "status-symbol").attr("x", 65).attr("y", -18).style("fill", "#fff").text("?");
            } else if (d.data.status === 'dead') {
                node.append("text").attr("class", "status-symbol").attr("x", 65).attr("y", -18).style("fill", "#fff").text("!");
            }
        }
    });

    // Restore spotlight opacities if state exists
    if (spotlightNodeId) {
        const activeNode = root.descendants().find(n => n.data.userId === spotlightNodeId);
        if (activeNode) applySpotlight(activeNode);
    } else {
        applySpotlight(null);
    }

    resetTreeZoom();
}

// 5. Spotlight Interactions
function toggleNode(d) {
    if (d.data.isMC) return; // Ignore missing children clicks
    
    // Clear search highlight
    d3.selectAll(".node").classed("search-highlight", false);

    if (spotlightNodeId === d.data.userId) {
        spotlightNodeId = null;
        applySpotlight(null);
        clearRightPane();
    } else {
        spotlightNodeId = d.data.userId;
        applySpotlight(d);
        g.selectAll(".node").classed("search-highlight", n => n.data.userId === spotlightNodeId);
        populateRightPane(d);
    }
}

function applySpotlight(clickedNode) {
    if (!spotlightNodeId || !clickedNode) {
        // Reset everything to default opacity
        d3.selectAll(".node")
            .transition()
            .duration(300)
            .style("opacity", 1);
            
        d3.selectAll(".link")
            .transition()
            .duration(300)
            .style("opacity", 0.6);
        return;
    }

    // Get rail nodes
    const ancestors = clickedNode.ancestors();
    const descendants = clickedNode.descendants();
    const railSet = new Set([...ancestors, ...descendants].map(n => n.data.userId));

    // Transition nodes (1.0 for active, 0.7 for rail, 0.15 for others)
    d3.selectAll(".node")
        .transition()
        .duration(300)
        .style("opacity", d => {
            if (d.data.userId === clickedNode.data.userId) return 1.0;
            return railSet.has(d.data.userId) ? 0.7 : 0.15;
        });

    // Transition links (0.9 for spotlight path, 0.05 for others)
    d3.selectAll(".link")
        .transition()
        .duration(300)
        .style("opacity", d => {
            const isSourceInRail = railSet.has(d.source.data.userId);
            const isTargetInRail = railSet.has(d.target.data.userId);
            return (isSourceInRail && isTargetInRail) ? 0.9 : 0.05;
        });
}

// ================= SEARCH FACTOR =================

function executeSearch() {
    const query = document.getElementById('globalSearch').value.toLowerCase().trim();
    performSearch(query, true);
}

function handleGlobalSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    if (e.key === 'Enter') {
        performSearch(query, true);
    } else {
        performSearch(query, false);
    }
}

function performSearch(query, isExplicit) {
    const matchCountSpan = document.getElementById('searchResultCount');
    const resultsList = document.getElementById('searchResultsList');
    
    if (query.length < 2) {
        matchCountSpan.textContent = '';
        if(resultsList) resultsList.innerHTML = '<div class="empty-state">No active search</div>';
        spotlightNodeId = null;
        applySpotlight(null);
        g.selectAll(".node").classed("search-highlight", false);
        clearRightPane();
        g.selectAll(".node .node-rect")
            .attr("stroke", d => d.data.isMC ? "transparent" : getStatusColor(d.data.status))
            .attr("stroke-width", 3);
        return;
    }

    let matches = [];
    g.selectAll(".node").each(function(d) {
        const name = (d.data.codeName || '').toLowerCase();
        const id = (d.data.userId || '').toLowerCase();
        if ((name.includes(query) || id.includes(query)) && !d.data.isMC) {
            matches.push(d);
        }
    });

    matchCountSpan.textContent = matches.length > 0
        ? `✨ ${matches.length} match${matches.length > 1 ? 'es' : ''} found`
        : '❌ No matches';

    if (matches.length > 0) {
        if(resultsList) {
            resultsList.innerHTML = '';
            matches.forEach(match => {
                const item = document.createElement('div');
                item.className = 'result-item';
                item.innerHTML = `
                    <div class="result-item-name">${match.data.codeName || 'Unknown'}</div>
                    <div class="result-item-id">ID: ${match.data.userId}</div>
                `;
                item.onclick = () => selectSearchResult(match.data.userId);
                resultsList.appendChild(item);
            });
        }

        const firstMatch = matches[0];
        spotlightNodeId = firstMatch.data.userId;
        applySpotlight(firstMatch);
        g.selectAll(".node").classed("search-highlight", d => d.data.userId === spotlightNodeId);
        populateRightPane(firstMatch);

        if (isExplicit) {
            zoomToNode(firstMatch);
        }
    } else {
        if(resultsList) resultsList.innerHTML = '<div class="empty-state">No matches found</div>';
        spotlightNodeId = null;
        applySpotlight(null);
        g.selectAll(".node").classed("search-highlight", false);
        clearRightPane();
    }
}

function populateRightPane(node) {
    const detailsContainer = document.getElementById('nodeDetailsContent');
    if (!detailsContainer || !node) return;

    const userId = node.data.userId;
    const data = rawData?.data_dump?.[userId] || {};

    const level = node.depth;
    const sponsorId = node.data.sponsorId || 'None';
    const sponsorName = sponsorId !== 'None' && rawData?.data_dump?.[sponsorId]?.documentName ? rawData.data_dump[sponsorId].documentName : 'N/A';
    const branch = node.data.position || 'Root';
    
    const descendants = node.descendants();
    const maxDepth = d3.max(descendants, d => d.depth);
    const levelsBelow = maxDepth - level;
    
    const realChildren = node.children ? node.children.filter(c => !c.data.isMC).length : 0;

    const nodeInfoProps = {
        "Name": data.documentName || node.data.codeName || 'Unknown',
        "ID": userId,
        "Status": data.status || node.data.status || 'safe',
        "Color": data.color || node.data.color || 'green',
        "Children": realChildren
    };

    const sponsorInfoProps = {
        "Sponsor Name": sponsorName,
        "Sponsor ID": sponsorId,
        "Branch": branch,
        "Tree Level": level,
        "Levels Below": levelsBelow
    };

    let html = `
        <div class="info-section">
            <div class="section-title">Node Info</div>
            <div class="node-details">
    `;
    for (const [key, value] of Object.entries(nodeInfoProps)) {
        html += `
                <div class="detail-item">
                    <div class="detail-label">${key}</div>
                    <div class="detail-value">${value}</div>
                </div>
        `;
    }
    
    html += `
            </div>
        </div>
        <div class="info-section" style="margin-top: 15px;">
            <div class="section-title">Sponsor Info & Stats</div>
            <div class="node-details">
    `;
    
    for (const [key, value] of Object.entries(sponsorInfoProps)) {
        html += `
                <div class="detail-item">
                    <div class="detail-label">${key}</div>
                    <div class="detail-value">${value}</div>
                </div>
        `;
    }

    html += `
            </div>
        </div>
    `;
    detailsContainer.innerHTML = html;
}

function clearRightPane() {
    const detailsContainer = document.getElementById('nodeDetailsContent');
    if (detailsContainer) {
        detailsContainer.innerHTML = '<div class="empty-state">Click a node to view full details</div>';
    }
}

function selectSearchResult(userId) {
    let targetNode = null;
    g.selectAll(".node").each(function(d) {
        if (d.data.userId === userId) {
            targetNode = d;
        }
    });

    if (targetNode) {
        spotlightNodeId = userId;
        applySpotlight(targetNode);
        g.selectAll(".node").classed("search-highlight", d => d.data.userId === spotlightNodeId);
        zoomToNode(targetNode);
        populateRightPane(targetNode);
    }
}

function getStatusColor(status) {
    if (status === 'safe') return "#006400";
    if (status === 'not_safe') return "#ffa502";
    if (status === 'dead') return "#ff4757";
    return "#c5a059";
}

function zoomToNode(d) {
    const container = document.querySelector('.tree-container');
    const w = container.clientWidth;
    const h = container.clientHeight;
    
    let targetScale = h / 1400;
    
    // Adjust clamp for mobile devices so nodes aren't microscopically tiny
    if (window.innerWidth <= 768) {
        targetScale = Math.max(0.4, Math.min(targetScale, 1.2));
    } else {
        targetScale = Math.max(0.2, Math.min(targetScale, 1.2));
    }
    
    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity.translate(w/2 - d.x * targetScale, h/2 - d.y * targetScale).scale(targetScale)
    );
}
// =================================================

function resetTreeZoom() {
    const container = document.querySelector('.tree-container');
    if (!container || !svg) return;
    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity.translate(container.clientWidth / 2, 100).scale(0.8)
    );
}

function updateTreeStats(root) {
    const allNodes = root.descendants();
    
    // 1. Levels Below: Max depth
    const levels = d3.max(allNodes, d => d.depth);
    
    // 2. Network Size: Total minus root, also exclude Missing Children (MC)
    const realNodes = allNodes.filter(d => !d.data.isMC);
    const nodesCountExcludingRoot = realNodes.length - 1;

    // 3. Pending Positions (MC Nodes)
    const mcCount = allNodes.filter(d => d.data.isMC).length;

    document.getElementById('levelsCount').textContent = levels || 0;
    document.getElementById('nodesCount').textContent = Math.max(0, nodesCountExcludingRoot);
    document.getElementById('mcCount').textContent = mcCount || 0;
}


