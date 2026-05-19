const { useState, useEffect } = dc;

function View(props) {
  const folderPath = props.folderPath || '';
  const [App, setApp] = useState(null);

  useEffect(() => {
    dc.require(folderPath + "/src/App.jsx")
      .then((module) => {
        setApp(() => module.View);
      })
      .catch((err) => {
        console.error("Failed to load D3.js component:", err);
      });
  }, [folderPath]);

  if (!App) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9d7cce', fontFamily: 'monospace' }}>
        <dc.Icon icon="loader-2" style={{ animation: "spin 1s linear infinite", marginRight: "8px" }} />
        Loading visualization modules...
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const Component = App;
  return <Component {...props} folderPath={folderPath} />;
}

return { View };
