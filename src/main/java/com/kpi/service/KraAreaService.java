package com.kpi.service;

import com.kpi.dto.request.KraAreaRequest;
import com.kpi.dto.response.KraAreaResponse;

import java.util.List;

public interface KraAreaService {

    List<KraAreaResponse> getAll(boolean activeOnly);

    KraAreaResponse getById(Integer id);

    KraAreaResponse create(KraAreaRequest request);

    KraAreaResponse update(Integer id, KraAreaRequest request);

    void delete(Integer id);
}
