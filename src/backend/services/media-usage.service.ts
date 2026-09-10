import { prisma } from '../config/db';

export interface MediaUsageReference {
  type: string;
  entityId: string;
  entityName: string;
  field: string;
  reference: string;
  status: 'ACTIVE' | 'ARCHIVED';
}

export interface MediaUsageResult {
  used: boolean;
  referenceCount: number;
  references: MediaUsageReference[];
}

export class MediaUsageService {
  /**
   * Comprehensive media usage check across all database tables, foreign keys,
   * raw image/logo/avatar URL columns, and rich-text content fields.
   */
  static async checkAssetUsage(
    assetIdOrIdentifier: string,
    prefetchedAsset?: any
  ): Promise<MediaUsageResult> {
    // 1. Locate the MediaAsset if not prefetched
    let asset = prefetchedAsset;
    if (!asset && assetIdOrIdentifier) {
      asset = await prisma.mediaAsset.findFirst({
        where: {
          OR: [
            { id: assetIdOrIdentifier },
            { publicId: assetIdOrIdentifier },
            { cloudinaryPublicId: assetIdOrIdentifier },
          ],
        },
      });
    }

    const assetId = asset?.id || assetIdOrIdentifier;

    // 2. Collect all candidate URLs (exact matching)
    const rawUrls = [asset?.url, asset?.secureUrl].filter(Boolean) as string[];
    if (assetIdOrIdentifier && (assetIdOrIdentifier.startsWith('http://') || assetIdOrIdentifier.startsWith('https://'))) {
      rawUrls.push(assetIdOrIdentifier);
    }

    const urlSet = new Set<string>();
    for (const u of rawUrls) {
      if (!u || u.trim() === '') continue;
      urlSet.add(u);
      // Also check protocol alternative (http vs https) if standard web URL
      if (u.startsWith('http://')) {
        urlSet.add(u.replace('http://', 'https://'));
      } else if (u.startsWith('https://')) {
        urlSet.add(u.replace('https://', 'http://'));
      }
    }
    const urls = Array.from(urlSet);

    // 3. Collect all candidate Public IDs
    const rawPublicIds = [
      asset?.publicId,
      asset?.cloudinaryPublicId,
      assetIdOrIdentifier && !assetIdOrIdentifier.startsWith('http') ? assetIdOrIdentifier : null,
    ].filter(Boolean) as string[];
    const publicIds = Array.from(new Set(rawPublicIds));

    const references: MediaUsageReference[] = [];

    // Helper to safely push reference avoiding duplicates
    const seenKeys = new Set<string>();
    const addReference = (ref: MediaUsageReference) => {
      const key = `${ref.type}:${ref.entityId}:${ref.field}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        references.push(ref);
      }
    };

    // 4. Run parallel checks across all known entity models
    const [
      blogPostsByFk,
      productImages,
      productOgImages,
      productContent,
      categories,
      categoryImages,
      brands,
      brandImages,
      banners,
      popups,
      brandingSettings,
      seoSettings,
      globalSeoSettings,
      seoMetadata,
      customers,
      reviewImages,
      blogContent,
      pagesContent,
      landingPagesContent,
    ] = await Promise.all([
      // A. BlogPost Foreign Key (featuredImageId)
      assetId
        ? prisma.blogPost.findMany({
            where: { featuredImageId: assetId },
            select: { id: true, title: true, deletedAt: true },
          })
        : Promise.resolve([]),

      // B. ProductImage (url, imageUrl, secureUrl, publicId, cloudinaryPublicId)
      urls.length > 0 || publicIds.length > 0
        ? prisma.productImage.findMany({
            where: {
              OR: [
                ...(urls.length > 0
                  ? [
                      { url: { in: urls } },
                      { imageUrl: { in: urls } },
                      { secureUrl: { in: urls } },
                    ]
                  : []),
                ...(publicIds.length > 0
                  ? [
                      { publicId: { in: publicIds } },
                      { cloudinaryPublicId: { in: publicIds } },
                    ]
                  : []),
              ],
            },
            include: {
              product: {
                select: { id: true, name: true, deletedAt: true },
              },
            },
          })
        : Promise.resolve([]),

      // C. Product.ogImage
      urls.length > 0
        ? prisma.product.findMany({
            where: { ogImage: { in: urls } },
            select: { id: true, name: true, ogImage: true, deletedAt: true },
          })
        : Promise.resolve([]),

      // D. Product Rich Text Content (description, shortDescription)
      urls.length > 0
        ? prisma.product.findMany({
            where: {
              OR: urls.flatMap((u) => [
                { description: { contains: u } },
                { shortDescription: { contains: u } },
              ]),
            },
            select: { id: true, name: true, description: true, shortDescription: true, deletedAt: true },
          })
        : Promise.resolve([]),

      // E. Category (image, icon, ogImage)
      urls.length > 0
        ? prisma.category.findMany({
            where: {
              OR: [
                { image: { in: urls } },
                { icon: { in: urls } },
                { ogImage: { in: urls } },
              ],
            },
            select: { id: true, name: true, image: true, icon: true, ogImage: true, deletedAt: true },
          })
        : Promise.resolve([]),

      // F. CategoryImage (secureUrl, cloudinaryPublicId)
      urls.length > 0 || publicIds.length > 0
        ? prisma.categoryImage.findMany({
            where: {
              OR: [
                ...(urls.length > 0 ? [{ secureUrl: { in: urls } }] : []),
                ...(publicIds.length > 0 ? [{ cloudinaryPublicId: { in: publicIds } }] : []),
              ],
            },
            include: {
              category: {
                select: { id: true, name: true, deletedAt: true },
              },
            },
          })
        : Promise.resolve([]),

      // G. Brand (logoUrl)
      urls.length > 0
        ? prisma.brand.findMany({
            where: { logoUrl: { in: urls } },
            select: { id: true, name: true, logoUrl: true, deletedAt: true },
          })
        : Promise.resolve([]),

      // H. BrandImage (secureUrl, cloudinaryPublicId)
      urls.length > 0 || publicIds.length > 0
        ? prisma.brandImage.findMany({
            where: {
              OR: [
                ...(urls.length > 0 ? [{ secureUrl: { in: urls } }] : []),
                ...(publicIds.length > 0 ? [{ cloudinaryPublicId: { in: publicIds } }] : []),
              ],
            },
            include: {
              brand: {
                select: { id: true, name: true, deletedAt: true },
              },
            },
          })
        : Promise.resolve([]),

      // I. Banner (desktopImage, mobileImage)
      urls.length > 0
        ? prisma.banner.findMany({
            where: {
              OR: [
                { desktopImage: { in: urls } },
                { mobileImage: { in: urls } },
              ],
            },
            select: { id: true, title: true, desktopImage: true, mobileImage: true, deletedAt: true },
          })
        : Promise.resolve([]),

      // J. Popup (imageUrl)
      urls.length > 0
        ? prisma.popup.findMany({
            where: { imageUrl: { in: urls } },
            select: { id: true, title: true, imageUrl: true, deletedAt: true },
          })
        : Promise.resolve([]),

      // K. BrandingSetting (logoUrl, darkLogoUrl, faviconUrl, adminPanelLogo, invoiceLogo, emailHeaderLogo)
      urls.length > 0
        ? prisma.brandingSetting.findMany({
            select: {
              id: true,
              logoUrl: true,
              darkLogoUrl: true,
              faviconUrl: true,
              adminPanelLogo: true,
              invoiceLogo: true,
              emailHeaderLogo: true,
            },
          })
        : Promise.resolve([]),

      // L. SEOSetting (ogImage, twitterImage)
      urls.length > 0
        ? prisma.sEOSetting.findMany({
            where: {
              OR: [
                { ogImage: { in: urls } },
                { twitterImage: { in: urls } },
              ],
            },
            select: { id: true, ogImage: true, twitterImage: true },
          })
        : Promise.resolve([]),

      // M. GlobalSeoSettings (defaultOgImage)
      urls.length > 0
        ? prisma.globalSeoSettings.findMany({
            where: { defaultOgImage: { in: urls } },
            select: { id: true, defaultOgImage: true },
          })
        : Promise.resolve([]),

      // N. SeoMetadata (ogImage)
      urls.length > 0
        ? prisma.seoMetadata.findMany({
            where: { ogImage: { in: urls } },
            select: { id: true, ogImage: true },
          })
        : Promise.resolve([]),

      // O. Customer (avatarUrl)
      urls.length > 0
        ? prisma.customer.findMany({
            where: { avatarUrl: { in: urls } },
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, deletedAt: true },
          })
        : Promise.resolve([]),

      // P. ReviewImage (url, cloudinaryPublicId)
      urls.length > 0 || publicIds.length > 0
        ? prisma.reviewImage.findMany({
            where: {
              OR: [
                ...(urls.length > 0 ? [{ url: { in: urls } }] : []),
                ...(publicIds.length > 0 ? [{ cloudinaryPublicId: { in: publicIds } }] : []),
              ],
            },
            include: {
              review: {
                select: {
                  id: true,
                  productId: true,
                  deletedAt: true,
                  product: { select: { id: true, name: true } },
                },
              },
            },
          })
        : Promise.resolve([]),

      // Q. BlogPost Rich Text Content
      urls.length > 0
        ? prisma.blogPost.findMany({
            where: {
              OR: urls.flatMap((u) => [
                { content: { contains: u } },
                { excerpt: { contains: u } },
              ]),
            },
            select: { id: true, title: true, content: true, excerpt: true, deletedAt: true },
          })
        : Promise.resolve([]),

      // R. Page Content
      urls.length > 0
        ? prisma.page.findMany({
            where: {
              OR: urls.map((u) => ({ content: { contains: u } })),
            },
            select: { id: true, title: true, content: true, deletedAt: true },
          })
        : Promise.resolve([]),

      // S. LandingPage Content
      urls.length > 0
        ? prisma.landingPage.findMany({
            where: {
              OR: urls.map((u) => ({ content: { contains: u } })),
            },
            select: { id: true, name: true, content: true, deletedAt: true },
          })
        : Promise.resolve([]),
    ]);

    // 5. Process and normalize results

    // A. BlogPost FK
    for (const post of blogPostsByFk) {
      addReference({
        type: 'BLOG_FEATURED_IMAGE',
        entityId: post.id,
        entityName: post.title,
        field: 'featuredImageId',
        reference: assetId,
        status: post.deletedAt ? 'ARCHIVED' : 'ACTIVE',
      });
    }

    // B. ProductImage
    for (const img of productImages) {
      const field = img.isPrimary
        ? 'primaryImage'
        : img.productVariantId
        ? 'variantImage'
        : 'galleryImage';
      addReference({
        type: 'PRODUCT_IMAGE',
        entityId: img.productId,
        entityName: img.product?.name || `Product (${img.productId})`,
        field,
        reference: img.url || img.imageUrl || img.secureUrl || img.publicId || '',
        status: img.deletedAt || img.product?.deletedAt ? 'ARCHIVED' : 'ACTIVE',
      });
    }

    // C. Product.ogImage
    for (const p of productOgImages) {
      addReference({
        type: 'PRODUCT_OG_IMAGE',
        entityId: p.id,
        entityName: p.name,
        field: 'ogImage',
        reference: p.ogImage || '',
        status: p.deletedAt ? 'ARCHIVED' : 'ACTIVE',
      });
    }

    // D. Product Content
    for (const p of productContent) {
      for (const u of urls) {
        if (p.description?.includes(u) || p.shortDescription?.includes(u)) {
          addReference({
            type: 'PRODUCT_CONTENT',
            entityId: p.id,
            entityName: p.name,
            field: p.description?.includes(u) ? 'description' : 'shortDescription',
            reference: u,
            status: p.deletedAt ? 'ARCHIVED' : 'ACTIVE',
          });
        }
      }
    }

    // E. Category
    for (const cat of categories) {
      if (cat.image && urls.includes(cat.image)) {
        addReference({
          type: 'CATEGORY_IMAGE',
          entityId: cat.id,
          entityName: cat.name,
          field: 'image',
          reference: cat.image,
          status: cat.deletedAt ? 'ARCHIVED' : 'ACTIVE',
        });
      }
      if (cat.icon && urls.includes(cat.icon)) {
        addReference({
          type: 'CATEGORY_ICON',
          entityId: cat.id,
          entityName: cat.name,
          field: 'icon',
          reference: cat.icon,
          status: cat.deletedAt ? 'ARCHIVED' : 'ACTIVE',
        });
      }
      if (cat.ogImage && urls.includes(cat.ogImage)) {
        addReference({
          type: 'CATEGORY_OG_IMAGE',
          entityId: cat.id,
          entityName: cat.name,
          field: 'ogImage',
          reference: cat.ogImage,
          status: cat.deletedAt ? 'ARCHIVED' : 'ACTIVE',
        });
      }
    }

    // F. CategoryImage
    for (const ci of categoryImages) {
      addReference({
        type: 'CATEGORY_GALLERY_IMAGE',
        entityId: ci.categoryId,
        entityName: ci.category?.name || `Category (${ci.categoryId})`,
        field: 'images',
        reference: ci.secureUrl || ci.cloudinaryPublicId || '',
        status: ci.category?.deletedAt ? 'ARCHIVED' : 'ACTIVE',
      });
    }

    // G. Brand
    for (const b of brands) {
      if (b.logoUrl && urls.includes(b.logoUrl)) {
        addReference({
          type: 'BRAND_LOGO',
          entityId: b.id,
          entityName: b.name,
          field: 'logoUrl',
          reference: b.logoUrl,
          status: b.deletedAt ? 'ARCHIVED' : 'ACTIVE',
        });
      }
    }

    // H. BrandImage
    for (const bi of brandImages) {
      addReference({
        type: 'BRAND_GALLERY_IMAGE',
        entityId: bi.brandId,
        entityName: bi.brand?.name || `Brand (${bi.brandId})`,
        field: 'images',
        reference: bi.secureUrl || bi.cloudinaryPublicId || '',
        status: bi.brand?.deletedAt ? 'ARCHIVED' : 'ACTIVE',
      });
    }

    // I. Banner
    for (const b of banners) {
      if (b.desktopImage && urls.includes(b.desktopImage)) {
        addReference({
          type: 'BANNER_DESKTOP',
          entityId: b.id,
          entityName: b.title,
          field: 'desktopImage',
          reference: b.desktopImage,
          status: b.deletedAt ? 'ARCHIVED' : 'ACTIVE',
        });
      }
      if (b.mobileImage && urls.includes(b.mobileImage)) {
        addReference({
          type: 'BANNER_MOBILE',
          entityId: b.id,
          entityName: b.title,
          field: 'mobileImage',
          reference: b.mobileImage,
          status: b.deletedAt ? 'ARCHIVED' : 'ACTIVE',
        });
      }
    }

    // J. Popup
    for (const pop of popups) {
      if (pop.imageUrl && urls.includes(pop.imageUrl)) {
        addReference({
          type: 'POPUP_IMAGE',
          entityId: pop.id,
          entityName: pop.title,
          field: 'imageUrl',
          reference: pop.imageUrl,
          status: pop.deletedAt ? 'ARCHIVED' : 'ACTIVE',
        });
      }
    }

    // K. BrandingSetting
    for (const bs of brandingSettings) {
      const fields: Array<keyof typeof bs> = [
        'logoUrl',
        'darkLogoUrl',
        'faviconUrl',
        'adminPanelLogo',
        'invoiceLogo',
        'emailHeaderLogo',
      ];
      for (const f of fields) {
        const val = bs[f];
        if (typeof val === 'string' && urls.includes(val)) {
          addReference({
            type: 'BRANDING_SETTING',
            entityId: bs.id,
            entityName: 'Store Branding Settings',
            field: String(f),
            reference: val,
            status: 'ACTIVE',
          });
        }
      }
    }

    // L. SEOSetting
    for (const seo of seoSettings) {
      if (seo.ogImage && urls.includes(seo.ogImage)) {
        addReference({
          type: 'SEO_SETTING',
          entityId: seo.id,
          entityName: 'General SEO Settings',
          field: 'ogImage',
          reference: seo.ogImage,
          status: 'ACTIVE',
        });
      }
      if (seo.twitterImage && urls.includes(seo.twitterImage)) {
        addReference({
          type: 'SEO_SETTING',
          entityId: seo.id,
          entityName: 'General SEO Settings',
          field: 'twitterImage',
          reference: seo.twitterImage,
          status: 'ACTIVE',
        });
      }
    }

    // M. GlobalSeoSettings
    for (const gSeo of globalSeoSettings) {
      if (gSeo.defaultOgImage && urls.includes(gSeo.defaultOgImage)) {
        addReference({
          type: 'GLOBAL_SEO_SETTING',
          entityId: gSeo.id,
          entityName: 'Global SEO Config',
          field: 'defaultOgImage',
          reference: gSeo.defaultOgImage,
          status: 'ACTIVE',
        });
      }
    }

    // N. SeoMetadata
    for (const meta of seoMetadata) {
      if (meta.ogImage && urls.includes(meta.ogImage)) {
        addReference({
          type: 'SEO_METADATA',
          entityId: meta.id,
          entityName: 'Page/Blog SEO Metadata',
          field: 'ogImage',
          reference: meta.ogImage,
          status: 'ACTIVE',
        });
      }
    }

    // O. Customer
    for (const cust of customers) {
      if (cust.avatarUrl && urls.includes(cust.avatarUrl)) {
        const name = `${cust.firstName || ''} ${cust.lastName || ''}`.trim() || cust.email || `Customer ${cust.id}`;
        addReference({
          type: 'CUSTOMER_AVATAR',
          entityId: cust.id,
          entityName: name,
          field: 'avatarUrl',
          reference: cust.avatarUrl,
          status: cust.deletedAt ? 'ARCHIVED' : 'ACTIVE',
        });
      }
    }

    // P. ReviewImage
    for (const ri of reviewImages) {
      addReference({
        type: 'REVIEW_IMAGE',
        entityId: ri.reviewId,
        entityName: `Customer Review for ${ri.review?.product?.name || ri.review?.productId || 'Product'}`,
        field: 'images',
        reference: ri.url,
        status: ri.review?.deletedAt ? 'ARCHIVED' : 'ACTIVE',
      });
    }

    // Q. BlogPost Content
    for (const post of blogContent) {
      for (const u of urls) {
        if (post.content?.includes(u) || post.excerpt?.includes(u)) {
          addReference({
            type: 'BLOG_CONTENT',
            entityId: post.id,
            entityName: post.title,
            field: post.content?.includes(u) ? 'content' : 'excerpt',
            reference: u,
            status: post.deletedAt ? 'ARCHIVED' : 'ACTIVE',
          });
        }
      }
    }

    // R. Page Content
    for (const pg of pagesContent) {
      for (const u of urls) {
        if (pg.content?.includes(u)) {
          addReference({
            type: 'PAGE_CONTENT',
            entityId: pg.id,
            entityName: pg.title,
            field: 'content',
            reference: u,
            status: pg.deletedAt ? 'ARCHIVED' : 'ACTIVE',
          });
        }
      }
    }

    // S. LandingPage Content
    for (const lp of landingPagesContent) {
      for (const u of urls) {
        if (lp.content?.includes(u)) {
          addReference({
            type: 'LANDING_PAGE_CONTENT',
            entityId: lp.id,
            entityName: lp.name,
            field: 'content',
            reference: u,
            status: lp.deletedAt ? 'ARCHIVED' : 'ACTIVE',
          });
        }
      }
    }

    return {
      used: references.length > 0,
      referenceCount: references.length,
      references,
    };
  }
}
