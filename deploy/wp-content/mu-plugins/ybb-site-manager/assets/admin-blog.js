(function ($) {
  var blockTypes = {
    paragraph: '段落',
    heading: '小标题',
    quote: '引用',
    image: '图片',
    mediaText: '图文',
    checklist: '清单',
    cta: '行动按钮',
  };

  var fieldTypes = {
    text: ['paragraph', 'heading', 'quote', 'mediaText', 'cta'],
    level: ['heading'],
    caption: ['quote', 'image'],
    imageUrl: ['image', 'mediaText'],
    alt: ['image', 'mediaText'],
    width: ['image'],
    eyebrow: ['mediaText'],
    title: ['mediaText', 'checklist', 'cta'],
    imageSide: ['mediaText'],
    items: ['checklist'],
    buttonLabel: ['cta'],
    href: ['cta'],
  };

  function blockTypeLabel(type) {
    return blockTypes[type] || type;
  }

  function fieldVisibleForType(fieldName, type) {
    var types = fieldTypes[fieldName] || [];
    return types.indexOf(type) !== -1;
  }

  function syncBlockFields($block) {
    var type = $block.find('[data-ybb-block-type]').val() || 'paragraph';
    $block.attr('data-active-type', type);
    $block.find('.ybb-blog-block-type-label').text(blockTypeLabel(type));
    $block.find('[data-ybb-field]').each(function () {
      var fieldName = $(this).data('ybb-field');
      $(this).toggleClass('is-hidden', !fieldVisibleForType(fieldName, type));
    });
  }

  function syncThumb($input) {
    var url = $.trim($input.val());
    var $wrap = $input.closest('.ybb-blog-field, td, p').find('.ybb-sm-thumb-wrap').first();
    if (!$wrap.length) {
      $wrap = $('<span class="ybb-sm-thumb-wrap"></span>').insertAfter($input.closest('label').length ? $input : $input);
    }
    if (!url) {
      $wrap.empty();
      return;
    }
    var $img = $wrap.find('img');
    if (!$img.length) {
      $img = $('<img class="ybb-sm-thumb" alt="" />').appendTo($wrap);
    }
    $img.attr('src', url);
  }

  function reindexBlocks() {
    $('#ybb-blog-blocks-list .ybb-blog-block').each(function (index) {
      var order = index + 1;
      $(this).find('[data-ybb-sort-order]').val(String(order));
      $(this).find('.ybb-blog-block-order').text(String(order));
    });
  }

  function buildBlockFromTemplate(type) {
    var $tpl = $('#ybb-blog-block-template');
    if (!$tpl.length) {
      return $();
    }
    var index = $('#ybb-blog-blocks-list .ybb-blog-block').length;
    var id = 'block-' + Date.now() + '-' + index;
    var html = $tpl.html()
      .replace(/__INDEX__/g, String(index))
      .replace(/__BLOCK_ID__/g, id)
      .replace(/__BLOCK_TYPE__/g, type);
    var $block = $(html);
    $block.find('[data-ybb-block-type]').val(type);
    $('#ybb-blog-blocks-list').append($block);
    syncBlockFields($block);
    reindexBlocks();
    return $block;
  }

  $(function () {
    $('#ybb-blog-blocks-list .ybb-blog-block').each(function () {
      syncBlockFields($(this));
    });
    $('.ybb-sm-image').each(function () {
      syncThumb($(this));
    });
  });

  $(document).on('change', '[data-ybb-block-type]', function () {
    syncBlockFields($(this).closest('.ybb-blog-block'));
  });

  $(document).on('input change', '.ybb-sm-image', function () {
    syncThumb($(this));
  });

  $(document).on('click', '.ybb-blog-add-block', function (e) {
    e.preventDefault();
    var type = $(this).data('block-type') || 'paragraph';
    buildBlockFromTemplate(type);
  });

  $(document).on('click', '.ybb-blog-remove-block', function (e) {
    e.preventDefault();
    if (!window.confirm('确定删除此内容块？')) {
      return;
    }
    $(this).closest('.ybb-blog-block').remove();
    reindexBlocks();
  });

  $(document).on('click', '.ybb-blog-move-block-up', function (e) {
    e.preventDefault();
    var $block = $(this).closest('.ybb-blog-block');
    var $prev = $block.prev('.ybb-blog-block');
    if ($prev.length) {
      $block.insertBefore($prev);
      reindexBlocks();
    }
  });

  $(document).on('click', '.ybb-blog-move-block-down', function (e) {
    e.preventDefault();
    var $block = $(this).closest('.ybb-blog-block');
    var $next = $block.next('.ybb-blog-block');
    if ($next.length) {
      $block.insertAfter($next);
      reindexBlocks();
    }
  });

  $(document).on('click', '.ybb-blog-import-legacy', function (e) {
    e.preventDefault();
    var raw = $.trim($('#ybb-blog-legacy-content').val() || '');
    if (!raw) {
      window.alert('没有可导入的旧版段落内容。');
      return;
    }
    buildBlockFromTemplate('paragraph').find('textarea[name$="[text]"]').val(raw);
    $('#ybb-blog-legacy-panel').hide();
  });
})(jQuery);
