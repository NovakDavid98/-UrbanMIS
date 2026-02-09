import { Buffer } from 'buffer';
import React from 'react';
import ReactDOM from 'react-dom';

window.global = window;
window.Buffer = Buffer;
window.process = window.process || { env: { NODE_ENV: 'production' } };
window.React = React;
window.ReactDOM = ReactDOM;
