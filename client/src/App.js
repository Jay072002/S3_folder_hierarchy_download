import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [downloadStatus, setDownloadStatus] = useState('');

  const handleDownload = async () => {
    try {
      setDownloadStatus('Downloading...');

      const response = await axios({
        method: 'get',
        url: 'http://localhost:5000/download',
        responseType: 'blob',
      });

      console.log(response,"response");
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'downloaded_files'); // Change the download name if needed
      document.body.appendChild(link);
      link.click();

      setDownloadStatus('Download Completed');
    } catch (error) {
      console.error('Error downloading files:', error);
      setDownloadStatus('Download Failed');
    }
  };

  return (
    <div className="App">
      <h1>S3 File Download Demo</h1>
      <button onClick={handleDownload}>Download Files</button>
      <p>{downloadStatus}</p>
    </div>
  );
}

export default App;
