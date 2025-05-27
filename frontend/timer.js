/* ====== TIMER SYSTEM ====== */
const Timer = (() => {
  let startTime = null;
  let elapsedTime = 0;
  let timerInterval = null;
  let isRunning = false;
  
  // Format time from seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Update display
  const updateDisplay = () => {
    if (!settings.showTimer) {
      $('#timerDisplay').style.display = 'none';
      return;
    }
    
    $('#timerDisplay').style.display = 'block';
    const currentTime = isRunning 
      ? elapsedTime + Math.floor((Date.now() - startTime) / 1000)
      : elapsedTime;
    $('#timerValue').textContent = formatTime(currentTime);
  };
  
  // Start timer
  const start = () => {
    if (isRunning) return;
    
    startTime = Date.now();
    isRunning = true;
    
    // Remove solved class when starting
    $('#timerDisplay').classList.remove('solved');
    
    // Update every second
    timerInterval = setInterval(() => {
      updateDisplay();
      if (!initializing) saveGame(); // Save progress
    }, 1000);
    
    updateDisplay();
  };
  
  // Stop timer
  const stop = () => {
    if (!isRunning) return;
    
    // Calculate final elapsed time
    elapsedTime += Math.floor((Date.now() - startTime) / 1000);
    isRunning = false;
    
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    // Add solved class to timer
    $('#timerDisplay').classList.add('solved');
    
    updateDisplay();
  };
  
  // Reset timer
  const reset = () => {
    stop();
    elapsedTime = 0;
    startTime = null;
    $('#timerDisplay').classList.remove('solved');
    updateDisplay();
  };
  
  // Get current time in seconds
  const getTime = () => {
    return isRunning 
      ? elapsedTime + Math.floor((Date.now() - startTime) / 1000)
      : elapsedTime;
  };
  
  // Set time (for loading saved games)
  const setTime = (seconds) => {
    elapsedTime = seconds || 0;
    startTime = Date.now();
    updateDisplay();
  };
  
  // Get timer state for saving
  const getState = () => ({
    elapsedTime: getTime(),
    isRunning
  });
  
  // Restore timer state
  const setState = (state) => {
    if (!state) return;
    
    elapsedTime = state.elapsedTime || 0;
    
    // Check both solved and wasSolved flags
    if (state.isRunning && !solved && !wasSolved) {
      start();
    } else {
      isRunning = false;
      // Add solved class if game was or is solved
      if (solved || wasSolved) {
        $('#timerDisplay').classList.add('solved');
      }
      updateDisplay();
    }
  };
  
  return {
    start,
    stop,
    reset,
    getTime,
    setTime,
    getState,
    setState,
    updateDisplay,
    formatTime,
    isRunning: () => isRunning
  };
})();