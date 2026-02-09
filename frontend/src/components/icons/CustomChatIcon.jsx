export const CustomChatIcon = ({ className = "w-6 h-6" }) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33793 17.0174C3.13053 18.0377 2.69686 19.6738 2.24982 20.9329C2.12888 21.2736 2.47642 21.597 2.81233 21.4391C4.1627 20.8043 6.00222 19.897 7.07897 19.2903C8.52932 19.7495 10.2144 20 12 20Z" fillOpacity="0.2" />
        <path fillRule="evenodd" clipRule="evenodd" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33793 17.0174C3.13053 18.0377 2.69686 19.6738 2.24982 20.9329C2.12888 21.2736 2.47642 21.597 2.81233 21.4391C4.1627 20.8043 6.00222 19.897 7.07897 19.2903C8.52932 19.7495 10.2144 20 12 20V22ZM7.5 9C7.5 8.17157 8.17157 7.5 9 7.5H15C15.8284 7.5 16.5 8.17157 16.5 9V13.5C16.5 14.3284 15.8284 15 15 15H9C8.17157 15 7.5 14.3284 7.5 13.5V9Z" fill="currentColor" />
        <path d="M6 10.5C6 9.67157 6.67157 9 7.5 9H9V13.5H7.5V15.75L6 13.875V10.5Z" fill="currentColor" fillOpacity="0.5" />
    </svg>
);

export const FloatingChatIcon = ({ className = "w-14 h-14" }) => (
    <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        {/* Base Circle - Indigo 600 */}
        <circle cx="32" cy="32" r="30" fill="#4F46E5" />

        {/* Bubbles */}
        <g transform="translate(14, 14) scale(0.75)">
            {/* Main Bubble */}
            <path d="M40 10H14C8.477 10 4 14.477 4 20V32C4 37.523 8.477 42 14 42H16V48C16 48.7 16.62 49.16 17.2 48.78L26.5 42H40C45.523 42 50 37.523 50 32V20C50 14.477 45.523 10 40 10Z" fill="white" />
            {/* Secondary Bubble Shadow/Accent */}
            <path d="M4 20C4 14.477 8.477 10 14 10H40C45.523 10 50 14.477 50 20V32C50 37.523 45.523 42 40 42H26.5L17.2 48.78C16.62 49.16 16 48.7 16 48V42H14C8.477 42 4 37.523 4 32V20Z" stroke="#4F46E5" strokeWidth="2" fillOpacity="0" />
        </g>
    </svg>
);
