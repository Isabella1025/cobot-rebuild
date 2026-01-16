// Authentication handling
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const loginBtnLoader = document.getElementById('loginBtnLoader');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    // Check if user is already logged in
    checkExistingSession();

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLogin();
    });

    async function handleLogin() {
        const courseCode = document.getElementById('courseCode').value.trim();
        const studentId = document.getElementById('studentId').value.trim();

        // Validate inputs
        if (!courseCode || !studentId) {
            showError('Please fill in all fields');
            return;
        }

        // Show loading state
        setLoadingState(true);
        hideMessages();

        try {
            const response = await fetch('/api/session/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    courseCode: courseCode,
                    studentId: studentId
                })
            });

            const data = await response.json();

            if (data.success) {
                showSuccess('Login successful! Redirecting...');
                
                // Store user data in sessionStorage for quick access
                sessionStorage.setItem('userData', JSON.stringify(data.data));
                
                // Redirect to group list after short delay
                setTimeout(() => {
                    window.location.href = '/group-list.html';
                }, 1000);
            } else {
                showError(data.message || 'Login failed. Please try again.');
                setLoadingState(false);
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('An error occurred. Please try again.');
            setLoadingState(false);
        }
    }

    async function checkExistingSession() {
        try {
            const response = await fetch('/api/session/verify');
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // User is already logged in, redirect to group list
                    window.location.href = '/group-list.html';
                }
            }
        } catch (error) {
            // No existing session or error, stay on login page
            console.log('No existing session');
        }
    }

    function setLoadingState(loading) {
        if (loading) {
            loginBtn.disabled = true;
            loginBtnText.style.opacity = '0';
            loginBtnLoader.style.display = 'block';
        } else {
            loginBtn.disabled = false;
            loginBtnText.style.opacity = '1';
            loginBtnLoader.style.display = 'none';
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
    }

    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }

    function hideMessages() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }

    // Auto-fill for testing (remove in production)
    if (window.location.hostname === 'localhost' && window.location.search.includes('test')) {
        document.getElementById('courseCode').value = 'CS101';
        document.getElementById('studentId').value = 'STU001';
    }
});