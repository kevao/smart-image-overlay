<?php

/**
 * Plugin Name: Smart Image Overlay
 * Description: Aplica overlay inteligente em thumbnails com base em brilho e transparência.
 * Version: 1.1.0
 * Author: Kevin Villanova
 */

if (!defined('ABSPATH')) exit;

function sio_enqueue_admin_scripts($hook)
{
  wp_enqueue_script(
    'smart-image-overlay',
    plugin_dir_url(__FILE__) . 'script.min.js',
    [],
    '1.1.0',
    true
  );
}

add_action('admin_enqueue_scripts', 'sio_enqueue_admin_scripts');
