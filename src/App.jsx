const { useRef, useEffect, useState } = dc;

function D3GraphView({ folderPath }) {
  const chartRef = useRef(null);
  const [activeTab, setActiveTab] = useState('network'); // network, force, flow
  const [isLoading, setIsLoading] = useState(true);
  const [charts, setCharts] = useState(null);
  
  // Full-tab mode state
  const [isFullTab, setIsFullTab] = useState(true);
  const containerRef = useRef(null);
  const stateRefs = useRef({}).current;
  const instanceId = useRef(Math.random().toString(36).substr(2, 5)).current;
  const uniqueWrapperClass = `d3js-wrapper-${instanceId}`;

  // DOM Traversal Utilities
  function findNearestAncestorWithClass(element, className) {
    if (!element) return null;
    let current = element.parentNode;
    while (current) {
      if (current.classList && current.classList.contains(className)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  function findDirectChildByClass(parent, className) {
    if (!parent) return null;
    for (const child of parent.children) {
      if (child.classList && child.classList.contains(className)) {
        return child;
      }
    }
    return null;
  }

  // Full-tab mode effect
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isFullTab) return;

    const targetPaneContent = findNearestAncestorWithClass(
      container,
      "workspace-leaf-content"
    );
    
    if (!targetPaneContent) {
      setIsFullTab(false);
      return;
    }

    const contentWrapper =
      findDirectChildByClass(targetPaneContent, "view-content") ||
      targetPaneContent;

    stateRefs.originalParent = container.parentNode;
    stateRefs.placeholder = document.createElement("div");
    stateRefs.placeholder.style.display = "none";
    container.parentNode.insertBefore(stateRefs.placeholder, container);

    stateRefs.parentPositionInfo = {
      element: contentWrapper,
      original: window.getComputedStyle(contentWrapper).position,
    };

    if (stateRefs.parentPositionInfo.original === "static") {
      contentWrapper.style.position = "relative";
    }

    contentWrapper.appendChild(container);

    Object.assign(container.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      zIndex: "9998",
      overflow: "auto",
    });

    return () => {
      if (stateRefs.placeholder?.parentNode) {
        stateRefs.placeholder.parentNode.replaceChild(
          container,
          stateRefs.placeholder
        );
      }
      if (stateRefs.parentPositionInfo?.element) {
        stateRefs.parentPositionInfo.element.style.position =
          stateRefs.parentPositionInfo.original === "static"
            ? ""
            : stateRefs.parentPositionInfo.original;
      }
      container.removeAttribute("style");
      Object.keys(stateRefs).forEach((key) => (stateRefs[key] = null));
    };
  }, [isFullTab]);

  // Cached script loader function
  async function loadScript(src) {
    const cacheDir = ".datacore/script_cache";
    const isUrl = /^https?:\/\//.test(src);
    
    if (!dc || !dc.app || !dc.app.vault || !dc.app.vault.adapter) {
      throw new Error("Datacore context 'dc' with vault adapter is required for loadScript.");
    }
    const adapter = dc.app.vault.adapter;

    return new Promise(async (resolve, reject) => {
      const scriptElement = document.createElement("script");
      scriptElement.async = true;

      try {
        if (isUrl) {
          const safeFilename = src
            .replace(/^https?:\/\//, '')
            .replace(/[\/\\?%*:|"<>]/g, '_') + ".js";
          const cachePath = `${cacheDir}/${safeFilename}`;

          let scriptText = null;
          const cachedExists = await adapter.exists(cachePath);

          if (cachedExists) {
            console.log(`[D3JS] Loading script from cache: ${cachePath}`);
            try {
              scriptText = await adapter.read(cachePath);
            } catch (readError) {
              console.warn(`[D3JS] Failed to read cache, refetching. Error:`, readError);
            }
          }

          if (scriptText === null) {
            console.log(`[D3JS] Fetching script from network: ${src}`);
            const response = await fetch(src);

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status} for ${src}`);
            }
            scriptText = await response.text();

            try {
              if (!(await adapter.exists(cacheDir))) {
                await adapter.mkdir(cacheDir);
              }
              await adapter.write(cachePath, scriptText);
            } catch (writeError) {
              console.warn(`[D3JS] Failed to write script to cache. Error:`, writeError);
            }
          }

          try {
            scriptElement.textContent = scriptText;
            document.body.appendChild(scriptElement);
            resolve(scriptElement);
          } catch (execError) {
            reject(execError);
          }
        } else {
          scriptElement.src = src;
          scriptElement.onload = () => resolve(scriptElement);
          scriptElement.onerror = () => reject(new Error(`Failed to load script ${src}`));
          document.head.appendChild(scriptElement);
        }
      } catch (error) {
        if (scriptElement.parentNode) {
          scriptElement.parentNode.removeChild(scriptElement);
        }
        reject(error);
      }
    });
  }

  // Load D3.js and helper module
  useEffect(() => {
    let active = true;
    async function loadDependencies() {
      if (!window.d3) {
        try {
          await loadScript("https://d3js.org/d3.v7.min.js");
        } catch (error) {
          console.error("Failed to load D3.js:", error);
          if (active) setIsLoading(false);
          return;
        }
      }
      try {
        const chartsMod = await dc.require(folderPath + "/src/utils/d3Charts.js");
        if (active) {
          setCharts(chartsMod);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to load D3 charts helpers:", error);
        if (active) setIsLoading(false);
      }
    }

    loadDependencies();
    return () => { active = false; };
  }, [folderPath]);

  // Render trigger with cleanup to prevent memory leaks
  useEffect(() => {
    if (isLoading || !window.d3 || !charts || !isFullTab || !chartRef.current) return;
    
    let cleanupFn;
    const d3 = window.d3;
    const width = 800;
    const height = 600;

    if (activeTab === 'network') {
      cleanupFn = charts.renderNetworkGraph(chartRef.current, d3, width, height);
    } else if (activeTab === 'force') {
      cleanupFn = charts.renderForceGraph(chartRef.current, d3, width, height);
    } else if (activeTab === 'flow') {
      cleanupFn = charts.renderFlowField(chartRef.current, d3, width, height);
    }

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, [activeTab, isLoading, charts, isFullTab]);

  const handleExitFullTab = (e) => {
    e.stopPropagation();
    setIsFullTab(false);
  };

  // Compact mode view
  if (!isFullTab) {
    return (
      <div ref={containerRef} style={{
        padding: "16px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        border: "1px dashed rgba(157, 124, 206, 0.3)",
        borderRadius: "8px",
        backgroundColor: "#0a0a0a"
      }}>
        <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
          D3.js Visualization is in compact mode
        </p>
        <button
          style={{
            padding: "8px 16px",
            fontSize: "12px",
            fontWeight: "500",
            color: "#fff",
            backgroundColor: "#9d7cce",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            letterSpacing: "1px",
            textTransform: "uppercase"
          }}
          onClick={() => setIsFullTab(true)}
        >
          Enter Full Tab
        </button>
      </div>
    );
  }

  // Full-tab mode view
  return (
    <div ref={containerRef} className={uniqueWrapperClass} style={{ height: "100%", width: "100%" }}>
      <style>{`
        .${uniqueWrapperClass} .subtle-icon {
          opacity: 0;
          transform: scale(0.9);
          transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
        }
        .${uniqueWrapperClass}:hover .subtle-icon {
          opacity: 0.7;
          transform: scale(1);
        }
        .${uniqueWrapperClass} .subtle-icon:hover {
          opacity: 1;
        }
        .${uniqueWrapperClass} .subtle-icon:hover .exit-tooltip {
          visibility: visible;
          opacity: 1;
        }
      `}</style>
      {isFullTab && (
        <style>{`
          .status-bar {
            display: none !important;
          }
        `}</style>
      )}
      
      <div 
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#000",
          color: "#9d7cce",
          fontFamily: "monospace",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative"
        }}
      >
        {/* Exit Full Tab Icon */}
        <div
          style={{
            position: "absolute",
            top: "15px",
            right: "20px",
            fontFamily: "monospace",
            fontSize: "18px",
            color: "#aaa",
            userSelect: "none",
            cursor: "pointer",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
          className="subtle-icon"
          onClick={handleExitFullTab}
        >
          <dc.Icon icon="x" style={{ fontSize: "20px" }} />
          <span className="exit-tooltip" style={{
            visibility: "hidden",
            opacity: 0,
            backgroundColor: "#0a0a0a",
            color: "#9d7cce",
            textAlign: "center",
            borderRadius: "4px",
            padding: "5px 10px",
            position: "absolute",
            zIndex: 1,
            top: "50%",
            right: "120%",
            transform: "translateY(-50%)",
            fontSize: "12px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            border: "1px solid rgba(157, 124, 206, 0.3)",
            transition: "opacity 0.2s, visibility 0.2s"
          }}>
            Exit Full Tab
          </span>
        </div>

        {/* Header */}
        <div style={{
          padding: "20px 30px",
          borderBottom: "1px solid rgba(157, 124, 206, 0.2)",
          backgroundColor: "#0a0a0a"
        }}>
          <h1 style={{
            margin: 0,
            fontSize: "1.5rem",
            fontWeight: "300",
            letterSpacing: "4px",
            textTransform: "uppercase",
            textShadow: "0 0 20px rgba(157, 124, 206, 0.4)"
          }}>D3.JS Visualization</h1>
          <p style={{
            margin: "8px 0 0 0",
            fontSize: "0.75rem",
            color: "#666",
            letterSpacing: "2px"
          }}>ENIGMATIC DATA RENDERING</p>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: "2px",
          padding: "20px 30px",
          backgroundColor: "#0a0a0a",
          borderBottom: "1px solid rgba(157, 124, 206, 0.1)"
        }}>
          <button
            onClick={() => setActiveTab('network')}
            style={{
              padding: "10px 24px",
              backgroundColor: activeTab === 'network' ? "rgba(157, 124, 206, 0.15)" : "transparent",
              color: activeTab === 'network' ? "#9d7cce" : "#666",
              border: activeTab === 'network' ? "1px solid rgba(157, 124, 206, 0.4)" : "1px solid #333",
              borderRadius: "2px",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "0.8rem",
              letterSpacing: "2px",
              textTransform: "uppercase",
              transition: "all 0.3s ease",
              boxShadow: activeTab === 'network' ? "0 0 15px rgba(157, 124, 206, 0.2)" : "none"
            }}
          >
            Network
          </button>
          <button
            onClick={() => setActiveTab('force')}
            style={{
              padding: "10px 24px",
              backgroundColor: activeTab === 'force' ? "rgba(157, 124, 206, 0.15)" : "transparent",
              color: activeTab === 'force' ? "#9d7cce" : "#666",
              border: activeTab === 'force' ? "1px solid rgba(157, 124, 206, 0.4)" : "1px solid #333",
              borderRadius: "2px",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "0.8rem",
              letterSpacing: "2px",
              textTransform: "uppercase",
              transition: "all 0.3s ease",
              boxShadow: activeTab === 'force' ? "0 0 15px rgba(157, 124, 206, 0.2)" : "none"
            }}
          >
            Force Graph
          </button>
          <button
            onClick={() => setActiveTab('flow')}
            style={{
              padding: "10px 24px",
              backgroundColor: activeTab === 'flow' ? "rgba(157, 124, 206, 0.15)" : "transparent",
              color: activeTab === 'flow' ? "#9d7cce" : "#666",
              border: activeTab === 'flow' ? "1px solid rgba(157, 124, 206, 0.4)" : "1px solid #333",
              borderRadius: "2px",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "0.8rem",
              letterSpacing: "2px",
              textTransform: "uppercase",
              transition: "all 0.3s ease",
              boxShadow: activeTab === 'flow' ? "0 0 15px rgba(157, 124, 206, 0.2)" : "none"
            }}
          >
            Flow Field
          </button>
        </div>

        {/* Visualization Area */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          position: "relative"
        }}>
          {isLoading ? (
            <div style={{
              color: "#9d7cce",
              fontSize: "1rem",
              letterSpacing: "3px",
              animation: "pulse 2s ease-in-out infinite"
            }}>
              Loading D3.js...
            </div>
          ) : (
            <div ref={chartRef} style={{
              boxShadow: "0 0 40px rgba(157, 124, 206, 0.2)",
              border: "1px solid rgba(157, 124, 206, 0.1)",
              borderRadius: "2px"
            }} />
          )}
        </div>

        {/* Info Footer */}
        <div style={{
          padding: "15px 30px",
          borderTop: "1px solid rgba(157, 124, 206, 0.1)",
          backgroundColor: "#0a0a0a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{
            fontSize: "0.7rem",
            color: "#555",
            letterSpacing: "1px"
          }}>
            {activeTab === 'network' && "Real-time animated network with proximity-based connections"}
            {activeTab === 'force' && "Interactive force-directed graph • Drag nodes to interact"}
            {activeTab === 'flow' && "Particle flow field with dynamic trails"}
          </div>
          <div style={{
            fontSize: "0.7rem",
            color: "#666",
            letterSpacing: "2px"
          }}>
            D3.js v7
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          button:hover {
            background-color: rgba(157, 124, 206, 0.1) !important;
            border-color: rgba(157, 124, 206, 0.3) !important;
          }
        `}</style>
      </div>
    </div>
  );
}

return { View: D3GraphView };
