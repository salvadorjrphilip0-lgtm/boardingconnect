import { supabase } from "../config/supabase.js";

// Get all listings
export const getAllListings = async (req, res) => {
  try {
    const { search, location, minPrice, maxPrice, verified, ownerId } =
      req.query;

    let query = supabase
      .from("listings")
      .select(
        "*, owner:users!owner_id(id, full_name, email, phone, profile_picture)",
      )
      .order("created_at", { ascending: false });

    // Filter by owner if ownerId is provided
    if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (location) {
      query = query.ilike("location", `%${location}%`);
    }

    if (minPrice) {
      query = query.gte("price", minPrice);
    }

    if (maxPrice) {
      query = query.lte("price", maxPrice);
    }

    if (verified === "true") {
      query = query.eq("verified", true);
    }

    const { data, error } = await query;

    if (error) throw error;

    const listingIds = (data || []).map((listing) => listing.id);
    let ratingSummaryByListing = {};

    if (listingIds.length > 0) {
      const { data: reviewRows, error: reviewsError } = await supabase
        .from("reviews")
        .select("listing_id, rating")
        .in("listing_id", listingIds);

      if (reviewsError) throw reviewsError;

      ratingSummaryByListing = (reviewRows || []).reduce((acc, review) => {
        const listingId = review.listing_id;
        const rating = Number(review.rating) || 0;

        if (!acc[listingId]) {
          acc[listingId] = { totalRatings: 0, ratingTotal: 0 };
        }

        acc[listingId].totalRatings += 1;
        acc[listingId].ratingTotal += rating;
        return acc;
      }, {});
    }

    // Transform data and ensure any stored images_paths are converted to public URLs
    const listings = await Promise.all(
      data.map(async (listing) => {
        let images = listing.images || [];

        // If no images array but there are stored paths, convert them to public URLs
        if (
          (!images || images.length === 0) &&
          Array.isArray(listing.images_paths) &&
          listing.images_paths.length > 0
        ) {
          const urls = await Promise.all(
            listing.images_paths.map(async (p) => {
              try {
                const { data: publicData } = await supabase.storage
                  .from("listings")
                  .getPublicUrl(p);
                return publicData?.publicUrl || publicData?.publicURL || null;
              } catch (e) {
                console.warn("Failed to get public URL for path", p, e);
                return null;
              }
            }),
          );
          images = urls.filter((u) => !!u);
        }

        return {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          location: listing.location,
          price: listing.price,
          capacity: listing.capacity,
          amenities: listing.amenities || [],
          images,
          images_paths: listing.images_paths || [],
          verified: listing.verified,
          status: listing.status || (listing.verified ? "approved" : "pending"),
          ownerId: listing.owner_id,
          owner: {
            id: listing.owner.id,
            fullName: listing.owner.full_name,
            email: listing.owner.email,
            phone: listing.owner.phone,
            profilePicture: listing.owner.profile_picture,
          },
          totalRatings: ratingSummaryByListing[listing.id]?.totalRatings || 0,
          averageRating:
            (ratingSummaryByListing[listing.id]?.totalRatings || 0) > 0
              ? Number(
                  (
                    ratingSummaryByListing[listing.id].ratingTotal /
                    ratingSummaryByListing[listing.id].totalRatings
                  ).toFixed(1),
                )
              : 0,
          createdAt: listing.created_at,
        };
      }),
    );

    res.json(listings);
  } catch (error) {
    console.error("Get listings error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get listing by ID
export const getListingById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("listings")
      .select(
        "*, owner:users!owner_id(id, full_name, email, phone, profile_picture)",
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    // Convert images_paths to public URLs when images array is empty
    let images = data.images || [];
    if (
      (!images || images.length === 0) &&
      Array.isArray(data.images_paths) &&
      data.images_paths.length > 0
    ) {
      const urls = await Promise.all(
        data.images_paths.map(async (p) => {
          try {
            const { data: publicData } = await supabase.storage
              .from("listings")
              .getPublicUrl(p);
            return publicData?.publicUrl || publicData?.publicURL || null;
          } catch (e) {
            console.warn("Failed to get public URL for path", p, e);
            return null;
          }
        }),
      );
      images = urls.filter((u) => !!u);
    }

    const { data: reviewRows, error: reviewsError } = await supabase
      .from("reviews")
      .select("rating")
      .eq("listing_id", id);

    if (reviewsError) throw reviewsError;

    const totalRatings = (reviewRows || []).length;
    const averageRating =
      totalRatings > 0
        ? Number(
            (
              (reviewRows || []).reduce(
                (sum, row) => sum + (Number(row.rating) || 0),
                0,
              ) / totalRatings
            ).toFixed(1),
          )
        : 0;

    const listing = {
      id: data.id,
      title: data.title,
      description: data.description,
      location: data.location,
      price: data.price,
      capacity: data.capacity,
      amenities: data.amenities || [],
      images,
      images_paths: data.images_paths || [],
      verified: data.verified,
      status: data.status || (data.verified ? "approved" : "pending"),
      ownerId: data.owner_id,
      owner: {
        id: data.owner.id,
        fullName: data.owner.full_name,
        email: data.owner.email,
        phone: data.owner.phone,
        profilePicture: data.owner.profile_picture,
      },
      totalRatings,
      averageRating,
      createdAt: data.created_at,
    };

    res.json(listing);
  } catch (error) {
    console.error("Get listing error:", error);
    res.status(500).json({ message: "Listing not found" });
  }
};

// Create listing
export const createListing = async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      price,
      capacity,
      amenities,
      images,
      images_paths,
    } = req.body;

    const insertObj = {
      title,
      description,
      location,
      price,
      capacity,
      amenities: amenities || [],
      images: images || [],
      images_paths: images_paths || [],
      owner_id: req.user.id,
      verified: false,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("listings")
      .insert([insertObj])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: "Listing created successfully",
      listing: data,
    });
  } catch (error) {
    console.error("Create listing error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update listing
export const updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, location, price, capacity, amenities, images } =
      req.body;

    // Check ownership
    const { data: existing } = await supabase
      .from("listings")
      .select("owner_id")
      .eq("id", id)
      .single();

    if (
      !existing ||
      (existing.owner_id !== req.user.id && req.user.role !== "admin")
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this listing" });
    }

    const { images_paths } = req.body;

    const { data, error } = await supabase
      .from("listings")
      .update({
        title,
        description,
        location,
        price,
        capacity,
        amenities,
        images,
        images_paths: images_paths || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: "Listing updated successfully",
      listing: data,
    });
  } catch (error) {
    console.error("Update listing error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete listing
export const deleteListing = async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const { data: existing } = await supabase
      .from("listings")
      .select("owner_id")
      .eq("id", id)
      .single();

    if (
      !existing ||
      (existing.owner_id !== req.user.id && req.user.role !== "admin")
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this listing" });
    }

    // Before deleting, fetch image storage paths and remove files
    try {
      const { data: listingRow, error: fetchErr } = await supabase
        .from("listings")
        .select("images_paths")
        .eq("id", id)
        .single();

      if (
        !fetchErr &&
        listingRow &&
        Array.isArray(listingRow.images_paths) &&
        listingRow.images_paths.length > 0
      ) {
        const { error: remErr } = await supabase.storage
          .from("listings")
          .remove(listingRow.images_paths);
        if (remErr)
          console.warn("Failed to remove listing images from storage", remErr);
      }
    } catch (err) {
      console.error("Error removing listing images before delete:", err);
    }

    const { error } = await supabase.from("listings").delete().eq("id", id);

    if (error) throw error;

    res.json({ message: "Listing deleted successfully" });
  } catch (error) {
    console.error("Delete listing error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload listing image via multipart/form-data
export const uploadListingImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ message: "File size exceeds 8MB limit" });
    }

    if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
      return res
        .status(400)
        .json({ message: "Only JPEG, PNG, and WebP images are allowed" });
    }

    // sanitize filename
    let fileName = req.file.originalname || "listing.jpg";
    fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

    const path = `listings/${req.user.id}/${Date.now()}_${fileName}`;
    console.log("Uploading image to path:", path);

    const { error: uploadError } = await supabase.storage
      .from("listings")
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      throw uploadError;
    }

    const { data: publicData } = await supabase.storage
      .from("listings")
      .getPublicUrl(path);

    // supabase client may return public URL under `publicUrl` or `publicURL` depending on version
    const publicUrl = publicData?.publicUrl || publicData?.publicURL || null;
    console.log(
      "Upload - publicData:",
      publicData,
      "publicUrl:",
      publicUrl,
      "path:",
      path,
    );

    if (!publicUrl) {
      console.warn(
        "Warning: publicUrl is null, but storage path is available:",
        path,
      );
    }

    res.json({ message: "Image uploaded", url: publicUrl, path });
  } catch (error) {
    console.error("Upload listing image error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
