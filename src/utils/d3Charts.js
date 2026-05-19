function renderNetworkGraph(chartRef, d3, width = 800, height = 600) {
  d3.select(chartRef).selectAll("*").remove();

  const svg = d3
    .select(chartRef)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#000");

  const nodes = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 3 + 2,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5
  }));

  const links = [];
  const linkGroup = svg.append("g");
  const nodeGroup = svg.append("g");
  const nodeElements = nodeGroup
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", d => d.r)
    .attr("fill", "#9d7cce")
    .attr("opacity", 0.8)
    .style("filter", "drop-shadow(0 0 4px #9d7cce)");

  let animId;
  function animate() {
    nodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;

      if (node.x < 0 || node.x > width) node.vx *= -1;
      if (node.y < 0 || node.y > height) node.vy *= -1;

      node.x = Math.max(0, Math.min(width, node.x));
      node.y = Math.max(0, Math.min(height, node.y));
    });

    links.length = 0;
    nodes.forEach((source, i) => {
      nodes.slice(i + 1).forEach(target => {
        const dx = source.x - target.x;
        const dy = source.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          links.push({ source, target, distance: dist });
        }
      });
    });

    linkGroup.selectAll("line").remove();
    linkGroup
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y)
      .attr("stroke", "#b19cd9")
      .attr("stroke-width", 1)
      .attr("opacity", d => 1 - (d.distance / 150));

    nodeElements
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    animId = requestAnimationFrame(animate);
  }

  animate();

  return () => {
    if (animId) cancelAnimationFrame(animId);
  };
}

function renderForceGraph(chartRef, d3, width = 800, height = 600) {
  d3.select(chartRef).selectAll("*").remove();

  const svg = d3
    .select(chartRef)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#000");

  const nodes = [
    { id: 0, group: 0, r: 15 },
    ...Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      group: Math.floor(Math.random() * 3) + 1,
      r: Math.random() * 5 + 3
    }))
  ];

  const links = nodes.slice(1).map(node => ({
    source: 0,
    target: node.id,
    value: Math.random()
  }));

  for (let i = 0; i < 15; i++) {
    links.push({
      source: Math.floor(Math.random() * 30) + 1,
      target: Math.floor(Math.random() * 30) + 1,
      value: Math.random()
    });
  }

  const colors = ["#9d7cce", "#b19cd9", "#8a6bb8", "#7a5ba8"];

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(80))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(d => d.r + 2));

  const link = svg.append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", "#555")
    .attr("stroke-opacity", 0.3)
    .attr("stroke-width", d => Math.sqrt(d.value) * 2);

  const node = svg.append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", d => d.r)
    .attr("fill", d => colors[d.group])
    .attr("opacity", 0.9)
    .style("filter", d => d.id === 0 ? "drop-shadow(0 0 8px #9d7cce)" : "drop-shadow(0 0 3px #b19cd9)")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);
  });

  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  return () => {
    simulation.stop();
  };
}

function renderFlowField(chartRef, d3, width = 800, height = 600) {
  d3.select(chartRef).selectAll("*").remove();

  const svg = d3
    .select(chartRef)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#000");

  const particles = Array.from({ length: 100 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: 0,
    vy: 0,
    trail: []
  }));

  const particleElements = svg.append("g")
    .selectAll("circle")
    .data(particles)
    .join("circle")
    .attr("r", 2)
    .attr("fill", "#9d7cce")
    .attr("opacity", 0.7)
    .style("filter", "drop-shadow(0 0 2px #9d7cce)");

  const trailGroup = svg.append("g");

  let time = 0;
  let animId;

  function animate() {
    time += 0.01;

    particles.forEach(p => {
      const angle = Math.sin(p.x * 0.01 + time) * Math.cos(p.y * 0.01 + time) * Math.PI * 2;
      p.vx = Math.cos(angle) * 2;
      p.vy = Math.sin(angle) * 2;

      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 20) p.trail.shift();

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;
    });

    particleElements
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    trailGroup.selectAll("path").remove();
    particles.forEach(p => {
      if (p.trail.length > 1) {
        const line = d3.line()
          .x(d => d.x)
          .y(d => d.y)
          .curve(d3.curveCardinal);

        trailGroup.append("path")
          .datum(p.trail)
          .attr("d", line)
          .attr("fill", "none")
          .attr("stroke", "#b19cd9")
          .attr("stroke-width", 1)
          .attr("opacity", 0.3);
      }
    });

    animId = requestAnimationFrame(animate);
  }

  animate();

  return () => {
    if (animId) cancelAnimationFrame(animId);
  };
}

return {
  renderNetworkGraph,
  renderForceGraph,
  renderFlowField
};
